import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// High-quality broker leads sheet (referral partners)
const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';

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

const APP_STATUS_RANK = ['cold','contacted','responded','meeting_scheduled','proposal_sent','converted','not_interested','current_client'];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function calcFollowUpDueDate(followUpStage, lastContactedDate) {
  if (!followUpStage) return null;
  const match = followUpStage.match(/Day\s+(\d+)/i);
  if (!match) return null;
  const days = parseInt(match[1], 10);
  const base = lastContactedDate ? new Date(lastContactedDate) : new Date();
  if (isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + days);
  return base.toISOString().split('T')[0];
}

function calcPartnerStatus(followUpStage) {
  if (!followUpStage || followUpStage.trim() === '') return 'Prospect';
  if (followUpStage.toLowerCase().includes('referral partner')) return 'Active Partner';
  return 'Prospect';
}

function rowToLead(row, rowIndex, sheetOriginKey, colMap) {
  const get = (i) => (row[i] || '').trim();
  // Case-insensitive column lookup
  const getByName = (name) => {
    if (!colMap) return '';
    const lowerName = name.toLowerCase();
    const key = Object.keys(colMap).find(k => k.toLowerCase() === lowerName);
    return key !== undefined ? get(colMap[key]) : '';
  };

  const firstName = get(0);
  const lastName = get(1);
  const col2 = get(2); // Should be email, but sometimes the sheet has company here

  // Extract email: first check col2, then scan col0+col1 for embedded email
  let email = '';
  let name = '';
  if (EMAIL_REGEX.test(col2)) {
    // col2 is a real email — normal layout
    email = col2.match(EMAIL_REGEX)[0];
    name = [firstName, lastName].filter(Boolean).join(' ');
  } else {
    // col2 is not an email (probably company name) — email may be embedded in col0 or col1
    const col0Email = firstName.match(EMAIL_REGEX);
    const col1Email = lastName.match(EMAIL_REGEX);
    if (col0Email) {
      email = col0Email[0];
      name = firstName.replace(col0Email[0], '').trim();
    } else if (col1Email) {
      email = col1Email[0];
      name = [firstName, lastName.replace(col1Email[0], '').trim()].filter(Boolean).join(' ');
    } else {
      name = [firstName, lastName].filter(Boolean).join(' ');
    }
  }

  if (!name || !email) return null;

  const sheetStatus = get(8).toLowerCase();
  const contactMethod = get(9).toLowerCase();

  let outreachChannel = 'other';
  if (contactMethod.includes('linkedin')) outreachChannel = 'linkedin';
  else if (contactMethod.includes('email')) outreachChannel = 'email';
  else if (contactMethod.includes('phone')) outreachChannel = 'phone';

  const location = get(6);
  const linkedin = get(7);

  // If col2 wasn't a real email, it's the company; otherwise company is col5
  const company = !EMAIL_REGEX.test(col2) && col2 ? col2 : get(5);

  const phone = getByName('Phone');
  const notes = getByName('Notes');
  const followUpStage = getByName('Follow Up Stage'); // case-insensitive, matches any variation
  const owner = getByName('Owner');
  const lastContactedDate = get(11); // existing last contacted col if present

  const followUpDueDate = calcFollowUpDueDate(followUpStage, lastContactedDate || null);
  const partnerStatus = calcPartnerStatus(followUpStage);

  return {
    name,
    email,
    title: get(4),
    company,
    industry: get(10),
    source: [location, linkedin].filter(Boolean).join(' | '),
    status: SHEET_STATUS_TO_APP[sheetStatus] || 'cold',
    outreach_channel: outreachChannel,
    sheet_row_id: String(rowIndex),
    sheet_origin: sheetOriginKey,
    lead_type: 'broker_lead',
    phone: phone || undefined,
    notes: notes || undefined,
    follow_up_stage: followUpStage || undefined,
    owner: owner || undefined,
    follow_up_due_date: followUpDueDate || undefined,
    partner_status: partnerStatus,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // ── Handle updateStage action ──────────────────────────────────────────────
    if (body.action === 'updateStage') {
      const { sheetRowId, sheetName, follow_up_stage, leadId } = body;
      console.log('updateStage called:', { sheetRowId, sheetName, follow_up_stage, leadId });

      if (!sheetRowId) {
        return Response.json({ error: 'Missing sheetRowId' }, { status: 400 });
      }

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      // Get the spreadsheet metadata to find the Follow Up Stage column index
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const availableSheets = meta.sheets?.map(s => s.properties?.title) || [];
      console.log('Available sheets:', availableSheets, '| requested sheetName:', sheetName);

      const targetSheet = sheetName || availableSheets[0] || 'Brokers';
      console.log('Using targetSheet:', targetSheet, '| sheetRowId:', sheetRowId);

      // Read header row to find the column index
      const headerRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!1:1')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const headerData = await headerRes.json();
      const headers = (headerData.values?.[0] || []).map(h => h.toLowerCase().trim());
      console.log('Headers found:', headers);
      const stageColIndex = headers.findIndex(h => h === 'follow up stage' || h === 'follow_up_stage');
      console.log('Follow Up Stage column index:', stageColIndex);

      if (stageColIndex === -1) {
        return Response.json({ error: 'Follow Up Stage column not found in sheet', headers }, { status: 400 });
      }

      // sheetRowId is the 1-based row number (including header row)
      const colLetter = String.fromCharCode(65 + stageColIndex); // A=65
      const cellRange = `${targetSheet}!${colLetter}${sheetRowId}`;
      console.log('Writing to cell range:', cellRange, '| value:', follow_up_stage);

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: cellRange, majorDimension: 'ROWS', values: [[follow_up_stage || '']] }),
        }
      );
      const updateData = await updateRes.json();
      console.log('Sheets API response:', JSON.stringify(updateData));
      if (updateData.error) {
        return Response.json({ error: updateData.error.message, details: updateData.error }, { status: 400 });
      }
      return Response.json({ success: true, updatedRange: updateData.updatedRange, cellRange, targetSheet });
    }

    const startRow = body.startRow || 0;
    const CHUNK_SIZE = 25;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // ── 1. Get sheet tabs metadata ─────────────────────────────────────────────
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    if (meta.error) {
      return Response.json({ error: `Metadata error: ${meta.error.message}` }, { status: 400 });
    }

    const sheetTabs = meta.sheets?.map(s => s.properties?.title) || [];
    // Use the first tab
    const SHEET_NAME = body.sheetName || sheetTabs[0] || 'Brokers';
    const sheetOriginKey = `BrokerLeads:${SHEET_NAME}`;

    // ── 2. Read using sheet GID (more reliable than name) ─────────────────────
    const sheetMeta = meta.sheets?.find(s => s.properties?.title === SHEET_NAME);
    const sheetId = sheetMeta?.properties?.sheetId;

    // Try reading by GID if available
    let rows = [];
    if (sheetId !== undefined) {
      // Use the sheets.data endpoint with gridId
      const dataRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?includeGridData=true&ranges=${encodeURIComponent(SHEET_NAME)}&fields=sheets(data(rowData(values(formattedValue))))`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const dataJson = await dataRes.json();
      if (dataJson.error) {
        return Response.json({ error: `Data error: ${dataJson.error.message}`, sheetTabs, SHEET_NAME }, { status: 400 });
      }
      const rowData = dataJson.sheets?.[0]?.data?.[0]?.rowData || [];
      rows = rowData.map(r => (r.values || []).map(c => c.formattedValue || ''));
    }

    if (rows.length === 0) {
      return Response.json({ success: true, created: 0, updated: 0, hasMore: false, nextStartRow: 0, totalRows: 0, sheetTabs, SHEET_NAME });
    }

    // Build a column name → index map from the header row
    const headerRow = rows[0] || [];
    const colMap = {};
    headerRow.forEach((header, idx) => {
      if (header) colMap[header.trim()] = idx;
    });

    const dataRows = rows.slice(1); // skip header

    // ── 3. Load existing broker_lead records for this sheet ────────────────────
    const existingLeads = await base44.asServiceRole.entities.Lead.filter(
      { sheet_origin: sheetOriginKey }, '-created_date', 500
    );
    const byEmail = {};
    const byRowId = {};
    for (const lead of existingLeads) {
      if (lead.email) byEmail[lead.email.toLowerCase()] = lead;
      if (lead.sheet_row_id) byRowId[`${sheetOriginKey}:${lead.sheet_row_id}`] = lead;
    }

    let created = 0;
    let updated = 0;

    const chunk = dataRows.slice(startRow, startRow + CHUNK_SIZE);

    // ── 4. One-way: Sheet → App only ───────────────────────────────────────────
    for (let i = 0; i < chunk.length; i++) {
      const rowIndex = startRow + i + 2; // 1-based, row 1 = header
      const lead = rowToLead(chunk[i], rowIndex, sheetOriginKey, colMap);
      if (!lead) continue;

      const existingByRow = byRowId[`${sheetOriginKey}:${String(rowIndex)}`];
      const existingByEmail = byEmail[lead.email.toLowerCase()];
      const existing = existingByRow || existingByEmail;

      if (existing) {
        const appRank = APP_STATUS_RANK.indexOf(existing.status);
        const sheetRank = APP_STATUS_RANK.indexOf(lead.status);
        const updates = {
          sheet_row_id: String(rowIndex),
          sheet_origin: sheetOriginKey,
          lead_type: 'broker_lead',
          name: lead.name,
          email: lead.email,
          title: lead.title,
          company: lead.company,
          industry: lead.industry,
          source: lead.source,
          outreach_channel: lead.outreach_channel,
          ...(lead.phone !== undefined && { phone: lead.phone }),
          ...(lead.notes !== undefined && { notes: lead.notes }),
          ...(lead.follow_up_stage !== undefined && { follow_up_stage: lead.follow_up_stage }),
          ...(lead.owner !== undefined && { owner: lead.owner }),
          ...(lead.follow_up_due_date !== undefined && { follow_up_due_date: lead.follow_up_due_date }),
          partner_status: lead.partner_status,
        };
        if (sheetRank > appRank) updates.status = lead.status;
        console.log('Writing follow_up_stage to lead (update):', updates.follow_up_stage, 'for contact:', updates.name);
        await base44.asServiceRole.entities.Lead.update(existing.id, updates);
        updated++;
      } else {
        console.log('Writing follow_up_stage to lead (create):', lead.follow_up_stage, 'for contact:', lead.name);
        await base44.asServiceRole.entities.Lead.create(lead);
        created++;
      }
    }

    const hasMore = startRow + CHUNK_SIZE < dataRows.length;
    const nextStartRow = startRow + CHUNK_SIZE;

    return Response.json({
      success: true,
      created,
      updated,
      hasMore,
      nextStartRow,
      totalRows: dataRows.length,
      sheetTabs,
      SHEET_NAME,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});