import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SPREADSHEET_ID = '1qK6sAv73EkBPfES1i--b2u1AanUt_Gu3_7yyth99OBA';

// Column indices (0-based) — Brokers sheet
const COL_BROKERS = {
  FIRST_NAME: 0,
  LAST_NAME: 1,
  EMAIL: 2,
  VALIDITY: 3,
  TITLE: 4,
  COMPANY: 5,
  LOCATION: 6,
  LINKEDIN: 7,
  STATUS: 8,
  CONTACT_METHOD: 9,
  TYPE: 10,
};

// Column indices (0-based) — ECs sheet
// Structure: FirstName | LastName | Email | Role | Company | Location | LinkedIn | Status | ContactMethod | Type
const COL_ECS = {
  FIRST_NAME: 0,
  LAST_NAME: 1,
  EMAIL: 2,
  TITLE: null,
  COMPANY: 4,
  LOCATION: 5,
  LINKEDIN: 6,
  STATUS: 7,
  CONTACT_METHOD: 8,
  TYPE: 9,
};

// Map sheet status → Lead entity status
const SHEET_STATUS_TO_APP = {
  'cold': 'cold',
  'contacted': 'contacted',
  'contacted (linkedin)': 'contacted',
  'responded': 'responded',
  'meeting scheduled': 'meeting_scheduled',
  'proposal sent': 'proposal_sent',
  'converted': 'converted',
  'not interested': 'not_interested',
  'client': 'current_client',
};

// Map Lead entity status → sheet status
const APP_STATUS_TO_SHEET = {
  cold: 'Cold',
  contacted: 'Contacted',
  responded: 'Responded',
  meeting_scheduled: 'Meeting Scheduled',
  proposal_sent: 'Proposal Sent',
  converted: 'Converted',
  not_interested: 'Not Interested',
  current_client: 'Client',
};

function rowToLead(row, rowIndex, sheetName) {
  const COL = sheetName === 'ECs' ? COL_ECS : COL_BROKERS;
  const get = (i) => (i === null || i === undefined ? '' : (row[i] || '').trim());

  const firstName = get(COL.FIRST_NAME);
  const lastName = COL.LAST_NAME !== null ? get(COL.LAST_NAME) : '';
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const email = get(COL.EMAIL);

  if (!name) return null;

  const sheetStatus = get(COL.STATUS).toLowerCase();
  const contactMethod = get(COL.CONTACT_METHOD).toLowerCase();

  let outreachChannel = 'other';
  if (contactMethod.includes('linkedin')) outreachChannel = 'linkedin';
  else if (contactMethod.includes('email')) outreachChannel = 'email';
  else if (contactMethod.includes('phone')) outreachChannel = 'phone';

  const location = get(COL.LOCATION);
  const linkedin = get(COL.LINKEDIN);

  return {
    name,
    email,
    title: COL.TITLE !== null ? get(COL.TITLE) : '',
    company: get(COL.COMPANY),
    industry: get(COL.TYPE) || (sheetName === 'ECs' ? 'Engagement Consultant' : ''),
    source: [location, linkedin].filter(Boolean).join(' | '),
    status: SHEET_STATUS_TO_APP[sheetStatus] || 'cold',
    outreach_channel: outreachChannel,
    sheet_row_id: String(rowIndex),
    sheet_origin: sheetName,
  };
}

function leadToSheetRow(lead) {
  const nameParts = (lead.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ');
  const status = APP_STATUS_TO_SHEET[lead.status] || 'Cold';
  
  return [
    firstName,
    lastName,
    lead.email || '',
    'Valid',
    lead.title || '',
    lead.company || '',
    '', // Location - not stored separately
    '', // LinkedIn - not stored separately
    status,
    lead.outreach_channel ? lead.outreach_channel.charAt(0).toUpperCase() + lead.outreach_channel.slice(1) : '',
    lead.industry || '',
  ];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const SHEET_NAME = body.sheetName || 'Brokers';
    const startRow = body.startRow || 0;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // ── 1. Read full sheet ─────────────────────────────────────────────────────────────────
    const range = encodeURIComponent(`${SHEET_NAME}!A1:K`);
    const sheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const sheetData = await sheetRes.json();
    const rows = sheetData.values || [];
    const dataRows = rows.slice(1); // skip header

    // ── 2. Load existing leads from DB (filtered by sheet origin) ────────────
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ sheet_origin: SHEET_NAME }, '-created_date', 500);
    const byEmail = {};
    const byRowId = {};
    for (const lead of existingLeads) {
      if (lead.email) byEmail[lead.email.toLowerCase()] = lead;
      if (lead.sheet_row_id) byRowId[`${SHEET_NAME}:${lead.sheet_row_id}`] = lead;
    }

    let created = 0;
    let updatedFromSheet = 0;
    const batchUpdates = [];

    // Process in chunks to avoid rate limits
    const CHUNK_SIZE = 25;
    const chunk = dataRows.slice(startRow, startRow + CHUNK_SIZE);

    // ── 3. Sheet → App ─────────────────────────────────────────────────────
    for (let i = 0; i < chunk.length; i++) {
      const rowIndex = startRow + i + 2; // 1-based sheet row (row 1 = header)
      const lead = rowToLead(chunk[i], rowIndex, SHEET_NAME);
      if (!lead) continue;

      const existingByRow = byRowId[`${SHEET_NAME}:${String(rowIndex)}`];
      const existingByEmail = lead.email ? byEmail[lead.email.toLowerCase()] : null;
      const existing = existingByRow || existingByEmail;

      if (existing) {
        const appStatusRank = Object.keys(APP_STATUS_TO_SHEET).indexOf(existing.status);
        const sheetStatusRank = Object.keys(APP_STATUS_TO_SHEET).indexOf(lead.status);
        const updates = {
          sheet_row_id: String(rowIndex),
          name: lead.name,
          email: lead.email,
          title: lead.title,
          company: lead.company,
          industry: lead.industry,
          source: lead.source,
          outreach_channel: lead.outreach_channel,
        };
        if (sheetStatusRank > appStatusRank) updates.status = lead.status;
        await base44.asServiceRole.entities.Lead.update(existing.id, updates);
        updatedFromSheet++;
        batchUpdates.push({ rowIndex, lead: { ...existing, ...updates } });
      } else {
        // For ECs allow no email; for Brokers require email
        if (!lead.email && SHEET_NAME !== 'ECs') continue;
        const newLead = await base44.asServiceRole.entities.Lead.create(lead);
        created++;
        batchUpdates.push({ rowIndex, lead: newLead });
      }
    }

    const hasMore = startRow + CHUNK_SIZE < dataRows.length;
    const nextStartRow = startRow + CHUNK_SIZE;

    // ── 4. App → Sheet: only write back for Brokers (ECs sheet is read-only) ────
    let pushedToSheet = 0;
    let appended = 0;

    if (SHEET_NAME !== 'ECs') {
      const writeRows = batchUpdates.map(({ rowIndex, lead }) => ({
        range: `${SHEET_NAME}!A${rowIndex}:K${rowIndex}`,
        values: [leadToSheetRow(lead)],
      }));

      if (writeRows.length > 0) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ valueInputOption: 'RAW', data: writeRows }),
          }
        );
        pushedToSheet = writeRows.length;
      }

      // Append app-only leads to sheet
      const appOnlyLeads = existingLeads.filter(l => !l.sheet_row_id && (!l.sheet_origin || l.sheet_origin === SHEET_NAME));
      const appendRows = appOnlyLeads.map(l => leadToSheetRow(l));

      if (appendRows.length > 0) {
        const appendRange = encodeURIComponent(`${SHEET_NAME}!A:K`);
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: appendRows }),
          }
        );
        appended = appendRows.length;

        const updatedSheetRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(`${SHEET_NAME}!C:C`)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const updatedSheet = await updatedSheetRes.json();
        const emailCol = (updatedSheet.values || []).slice(1);

        for (const lead of appOnlyLeads) {
          const idx = emailCol.findIndex(r => r[0]?.toLowerCase() === lead.email?.toLowerCase());
          if (idx >= 0) {
            await base44.asServiceRole.entities.Lead.update(lead.id, { sheet_row_id: String(idx + 2) });
          }
        }
      }
    }

    return Response.json({
      success: true,
      created,
      updatedFromSheet,
      pushedToSheet,
      appended,
      hasMore,
      nextStartRow,
      totalRows: dataRows.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});