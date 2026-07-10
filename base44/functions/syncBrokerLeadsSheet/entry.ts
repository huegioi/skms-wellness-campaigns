import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// High-quality broker leads sheet (referral partners)
const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';

const SHEET_STATUS_TO_APP = {
  'cold': 'cold',
  'contacted': 'contacted',
  'contacted (linkedin)': 'contacted',
  'responded': 'in_conversation',
  'in conversation': 'in_conversation',
  'meeting scheduled': 'meeting_scheduled',
  'proposal sent': 'proposal_sent',
  'converted': 'converted',
  'not interested': 'not_interested',
  'client': 'current_client',
  'current client': 'current_client',
};

const APP_STATUS_RANK = ['cold','contacted','in_conversation','meeting_scheduled','proposal_sent','converted','not_interested','current_client'];

// Pipeline Stage column label ↔ Lead.status enum mapping
const PIPELINE_STAGE_LABEL_TO_ENUM = {
  'new': 'cold',
  'contacted': 'contacted',
  'in conversation': 'in_conversation',
  'meeting scheduled': 'meeting_scheduled',
  'proposal sent': 'proposal_sent',
  'converted': 'converted',
  'not interested': 'not_interested',
  'current client': 'current_client',
};

const ENUM_TO_PIPELINE_STAGE_LABEL = {
  'cold': 'New',
  'contacted': 'Contacted',
  'in_conversation': 'In Conversation',
  'meeting_scheduled': 'Meeting Scheduled',
  'proposal_sent': 'Proposal Sent',
  'converted': 'Converted',
  'not_interested': 'Not Interested',
  'current_client': 'Current Client',
  'responded': 'In Conversation',
};

function normalizeStatus(status) {
  return status === 'responded' ? 'in_conversation' : (status || 'cold');
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function calcFollowUpDueDate(followUpStage, lastContactedDate, existingLastContactedDate) {
  if (!followUpStage) return null;
  const match = followUpStage.match(/Day\s+(\d+)/i);
  // Stages without a "Day N" are engagement stages — never show an overdue badge
  if (!match) return null;
  const days = parseInt(match[1], 10);
  // Prefer the sheet's last contacted, then the existing app value, then don't default to today
  const baseStr = lastContactedDate || existingLastContactedDate || null;
  if (!baseStr) return null;
  const base = new Date(baseStr);
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

  // Use named columns exclusively — the sheet layout is:
  // Col 0: Contact Name, Col 1: Owner, Col 2: Email, Col 3: Company,
  // Col 4: Follow up Stage, Col 5: Notes, Col 6: Phone, Col 7: Address
  const name = getByName('Contact Name') || getByName('Name') || getByName('Full Name') || get(0);
  const rawEmail = getByName('Email') || getByName('Email Address') || get(2);
  const emailMatch = rawEmail.match(EMAIL_REGEX);
  const email = emailMatch ? emailMatch[0] : '';

  if (!name || !email) return null;

  const company = getByName('Company') || getByName('Brokerage') || '';
  const phone = getByName('Phone') || getByName('Phone Number') || '';
  const notes = getByName('Notes') || '';
  const owner = getByName('Owner') || '';

  // Pipeline Stage is the canonical status source (replaces old Status + Follow Up Stage columns)
  const pipelineStageRaw = (getByName('Pipeline Stage') || '').toLowerCase().trim();
  const pipelineStatus = pipelineStageRaw ? (PIPELINE_STAGE_LABEL_TO_ENUM[pipelineStageRaw] || null) : null;
  if (pipelineStageRaw && !pipelineStatus) {
    console.warn(`Unrecognized Pipeline Stage "${pipelineStageRaw}" for ${email} — ignoring`);
  }

  return {
    name,
    email,
    title: getByName('Title') || getByName('Job Title') || undefined,
    company: company || undefined,
    industry: getByName('Industry') || undefined,
    source: getByName('LinkedIn') || getByName('Source') || undefined,
    status: pipelineStatus || 'cold',
    _hasPipelineStage: !!pipelineStatus,
    outreach_channel: 'other',
    sheet_row_id: String(rowIndex),
    sheet_origin: sheetOriginKey,
    lead_type: 'broker_lead',
    phone: phone || undefined,
    notes: notes || undefined,
    owner: owner || undefined,
    // follow_up_stage, follow_up_due_date, partner_status are no longer synced from the sheet.
    // Tags are write-only (app → sheet). Never read them back during Sheet → App sync.
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

    // ── Handle initPipelineStage action (one-time: add column + backfill) ──────
    if (body.action === 'initPipelineStage') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      // 1. Get spreadsheet metadata to find sheetId
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const targetSheet = 'Referral Partners';
      const sheetObj = meta.sheets?.find(s => s.properties?.title === targetSheet);
      const sheetId = sheetObj?.properties?.sheetId;
      if (sheetId === undefined) {
        return Response.json({ error: `Tab "${targetSheet}" not found` }, { status: 400 });
      }

      // 2. Read header row
      const headerRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!1:1')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const headerData = await headerRes.json();
      const headers = (headerData.values?.[0] || []).map(h => h.toLowerCase().trim());

      // 3. Find Follow Up Stage column
      const followUpIdx = headers.findIndex(h => h === 'follow up stage' || h === 'follow_up_stage');
      if (followUpIdx === -1) {
        return Response.json({ error: 'Follow Up Stage column not found' }, { status: 400 });
      }

      // 4. Check if Pipeline Stage already exists
      const existingPipelineIdx = headers.findIndex(h => h === 'pipeline stage');
      if (existingPipelineIdx !== -1) {
        console.log('Pipeline Stage column already exists at index', existingPipelineIdx);
      } else {
        // 5. Insert a new column after Follow Up Stage
        const insertRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: followUpIdx + 1,
                    endIndex: followUpIdx + 2,
                  },
                  inheritFromBefore: true,
                },
              }],
            }),
          }
        );
        const insertData = await insertRes.json();
        if (insertData.error) {
          return Response.json({ error: insertData.error.message }, { status: 400 });
        }

        // 6. Write header "Pipeline Stage"
        const colLetter = String.fromCharCode(65 + followUpIdx + 1);
        const headerRange = `${targetSheet}!${colLetter}1:${colLetter}1`;
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ range: headerRange, majorDimension: 'ROWS', values: [['Pipeline Stage']] }),
          }
        );
        console.log('Pipeline Stage column inserted at index', followUpIdx + 1);
      }

      // 7. Backfill: read all leads and build email → status label map
      const allLeads = await base44.asServiceRole.entities.Lead.filter(
        { lead_type: 'broker_lead' }, '-created_date', 1000
      );
      const statusLabelByEmail = {};
      for (const lead of allLeads) {
        if (lead.is_demo) continue;
        if (lead.email) {
          const ns = normalizeStatus(lead.status);
          statusLabelByEmail[lead.email.toLowerCase()] = ENUM_TO_PIPELINE_STAGE_LABEL[ns] || 'New';
        }
      }

      // 8. Read all rows and write Pipeline Stage values
      const tabRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!A:Z')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const tabData = await tabRes.json();
      const allRows = tabData.values || [];
      if (allRows.length < 2) {
        return Response.json({ success: true, message: 'No data rows to backfill', targetSheet });
      }

      const updatedHeaders = (allRows[0] || []).map(h => h.toLowerCase().trim());
      const emailColIdx = updatedHeaders.findIndex(h => h === 'email' || h === 'email address');
      const pipelineColIdx = updatedHeaders.findIndex(h => h === 'pipeline stage');

      if (emailColIdx === -1 || pipelineColIdx === -1) {
        return Response.json({ error: 'Email or Pipeline Stage column not found after insertion', updatedHeaders }, { status: 400 });
      }

      const pipelineValues = [];
      let backfilled = 0;
      for (let i = 1; i < allRows.length; i++) {
        const email = (allRows[i][emailColIdx] || '').trim().toLowerCase();
        const label = statusLabelByEmail[email];
        pipelineValues.push([label || '']);
        if (label) backfilled++;
      }

      const pipelineColLetter = String.fromCharCode(65 + pipelineColIdx);
      const dataRange = `${targetSheet}!${pipelineColLetter}2:${pipelineColLetter}${allRows.length}`;
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(dataRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: dataRange, majorDimension: 'ROWS', values: pipelineValues }),
        }
      );
      const writeData = await writeRes.json();
      if (writeData.error) {
        return Response.json({ error: writeData.error.message }, { status: 400 });
      }

      return Response.json({ success: true, targetSheet, backfilled, totalRows: allRows.length - 1 });
    }

    // ── Handle updatePipelineStage action (app → sheet single-cell write) ───────
    if (body.action === 'updatePipelineStage') {
      const { sheetRowId, sheetName, status, leadId, email } = body;

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const availableSheets = meta.sheets?.map(s => s.properties?.title) || [];
      const knownGoodTabs = ['Referral Partners', 'Broker Leads', 'Brokers'];
      const targetSheet = availableSheets.includes(sheetName)
        ? sheetName
        : knownGoodTabs.find(t => availableSheets.includes(t)) || availableSheets[0] || 'Referral Partners';

      const tabRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!A:Z')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const tabData = await tabRes.json();
      const allRows = tabData.values || [];
      if (allRows.length === 0) {
        return Response.json({ error: `Tab "${targetSheet}" is empty` }, { status: 400 });
      }

      const headers = (allRows[0] || []).map(h => h.toLowerCase().trim());
      const emailColIdx = headers.findIndex(h => h === 'email' || h === 'email address');
      const pipelineColIdx = headers.findIndex(h => h === 'pipeline stage');

      if (pipelineColIdx === -1) {
        return Response.json({ error: 'Pipeline Stage column not found. Run initPipelineStage first.', headers }, { status: 400 });
      }

      let matchedRowNum = null;
      if (email && emailColIdx >= 0) {
        const normEmail = email.trim().toLowerCase();
        for (let i = 1; i < allRows.length; i++) {
          const cellEmail = (allRows[i][emailColIdx] || '').trim().toLowerCase();
          if (cellEmail === normEmail) {
            matchedRowNum = i + 1;
            break;
          }
        }
      }

      if (!matchedRowNum && sheetRowId) {
        matchedRowNum = parseInt(sheetRowId, 10);
      }

      if (!matchedRowNum) {
        return Response.json({
          error: `Could not find row for email "${email}" and no sheetRowId provided`,
          targetSheet, email, sheetRowId,
        }, { status: 400 });
      }

      const ns = normalizeStatus(status);
      const label = ENUM_TO_PIPELINE_STAGE_LABEL[ns] || '';

      const colLetter = String.fromCharCode(65 + pipelineColIdx);
      const cellRange = `${targetSheet}!${colLetter}${matchedRowNum}`;

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: cellRange, majorDimension: 'ROWS', values: [[label]] }),
        }
      );
      const updateData = await updateRes.json();
      if (updateData.error) {
        return Response.json({ error: updateData.error.message }, { status: 400 });
      }

      if (leadId) {
        try {
          await base44.asServiceRole.entities.Lead.update(leadId, {
            sheet_row_id: String(matchedRowNum),
            sheet_origin: `BrokerLeads:${targetSheet}`,
          });
        } catch (e) {
          console.warn('Failed to update sheet_row_id on lead:', e.message);
        }
      }

      return Response.json({ success: true, updatedRange: updateData.updatedRange, cellRange, targetSheet, matchedRowNum, label });
    }

    // ── Handle updateStage action ──────────────────────────────────────────────
    if (body.action === 'updateStage') {
      const { sheetRowId, sheetName, follow_up_stage, leadId, email } = body;
      console.log('updateStage called:', { sheetRowId, sheetName, follow_up_stage, leadId, email });

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      // Resolve canonical tab name
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const availableSheets = meta.sheets?.map(s => s.properties?.title) || [];
      console.log('Available sheets:', availableSheets, '| requested sheetName:', sheetName);

      const knownGoodTabs = ['Referral Partners', 'Broker Leads', 'Brokers'];
      const targetSheet = availableSheets.includes(sheetName)
        ? sheetName
        : knownGoodTabs.find(t => availableSheets.includes(t)) || availableSheets[0] || 'Referral Partners';
      console.log('Using targetSheet:', targetSheet);

      // Read the whole tab — header row + all data rows
      const tabRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!A:Z')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const tabData = await tabRes.json();
      const allRows = tabData.values || [];
      if (allRows.length === 0) {
        return Response.json({ error: `Tab "${targetSheet}" is empty` }, { status: 400 });
      }

      const headers = (allRows[0] || []).map(h => h.toLowerCase().trim());
      const emailColIdx = headers.findIndex(h => h === 'email' || h === 'email address');
      const stageColIdx = headers.findIndex(h => h === 'follow up stage' || h === 'follow_up_stage');
      console.log('Headers:', headers, '| email col:', emailColIdx, '| stage col:', stageColIdx);

      if (stageColIdx === -1) {
        return Response.json({ error: 'Follow Up Stage column not found in sheet', headers }, { status: 400 });
      }

      // Find row by email match (case-insensitive, trimmed)
      let matchedRowNum = null;
      if (email && emailColIdx >= 0) {
        const normEmail = email.trim().toLowerCase();
        for (let i = 1; i < allRows.length; i++) {
          const cellEmail = (allRows[i][emailColIdx] || '').trim().toLowerCase();
          if (cellEmail === normEmail) {
            matchedRowNum = i + 1; // 1-based row number including header
            break;
          }
        }
      }

      // Fall back to sheetRowId if no email match
      if (!matchedRowNum && sheetRowId) {
        matchedRowNum = parseInt(sheetRowId, 10);
      }

      if (!matchedRowNum) {
        return Response.json({
          error: `Could not find row for email "${email}" and no sheetRowId provided`,
          targetSheet, email, sheetRowId,
        }, { status: 400 });
      }

      const colLetter = String.fromCharCode(65 + stageColIdx);
      const cellRange = `${targetSheet}!${colLetter}${matchedRowNum}`;
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

      // Write back the matched row number so sheet_row_id stays fresh
      if (leadId) {
        try {
          await base44.asServiceRole.entities.Lead.update(leadId, {
            sheet_row_id: String(matchedRowNum),
            sheet_origin: `BrokerLeads:${targetSheet}`,
          });
        } catch (e) {
          console.warn('Failed to update sheet_row_id on lead:', e.message);
        }
      }

      return Response.json({ success: true, updatedRange: updateData.updatedRange, cellRange, targetSheet, matchedRowNum });
    }

    // ── Handle updateOwner action ──────────────────────────────────────────────
    if (body.action === 'updateOwner') {
      const { sheetRowId, sheetName, owner, leadId, email } = body;

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const availableSheets = meta.sheets?.map(s => s.properties?.title) || [];
      const knownGoodTabsOwner = ['Referral Partners', 'Broker Leads', 'Brokers'];
      const targetSheet = availableSheets.includes(sheetName)
        ? sheetName
        : knownGoodTabsOwner.find(t => availableSheets.includes(t)) || availableSheets[0] || 'Referral Partners';

      // Read the whole tab — header row + all data rows
      const tabRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!A:Z')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const tabData = await tabRes.json();
      const allRows = tabData.values || [];
      if (allRows.length === 0) {
        return Response.json({ error: `Tab "${targetSheet}" is empty` }, { status: 400 });
      }

      const headers = (allRows[0] || []).map(h => h.toLowerCase().trim());
      const emailColIdx = headers.findIndex(h => h === 'email' || h === 'email address');
      const ownerColIdx = headers.findIndex(h => h === 'owner');

      if (ownerColIdx === -1) {
        return Response.json({ error: 'Owner column not found in sheet', headers }, { status: 400 });
      }

      // Find row by email match (case-insensitive, trimmed)
      let matchedRowNum = null;
      if (email && emailColIdx >= 0) {
        const normEmail = email.trim().toLowerCase();
        for (let i = 1; i < allRows.length; i++) {
          const cellEmail = (allRows[i][emailColIdx] || '').trim().toLowerCase();
          if (cellEmail === normEmail) {
            matchedRowNum = i + 1;
            break;
          }
        }
      }

      // Fall back to sheetRowId if no email match
      if (!matchedRowNum && sheetRowId) {
        matchedRowNum = parseInt(sheetRowId, 10);
      }

      if (!matchedRowNum) {
        return Response.json({
          error: `Could not find row for email "${email}" and no sheetRowId provided`,
          targetSheet, email, sheetRowId,
        }, { status: 400 });
      }

      const colLetter = String.fromCharCode(65 + ownerColIdx);
      const cellRange = `${targetSheet}!${colLetter}${matchedRowNum}`;

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: cellRange, majorDimension: 'ROWS', values: [[owner || '']] }),
        }
      );
      const updateData = await updateRes.json();
      if (updateData.error) {
        return Response.json({ error: updateData.error.message }, { status: 400 });
      }

      // Write back the matched row number so sheet_row_id stays fresh
      if (leadId) {
        try {
          await base44.asServiceRole.entities.Lead.update(leadId, {
            sheet_row_id: String(matchedRowNum),
            sheet_origin: `BrokerLeads:${targetSheet}`,
          });
        } catch (e) {
          console.warn('Failed to update sheet_row_id on lead:', e.message);
        }
      }

      return Response.json({ success: true, updatedRange: updateData.updatedRange, cellRange, targetSheet, matchedRowNum });
    }

    // ── Handle updateTags action ───────────────────────────────────────────────
    if (body.action === 'updateTags') {
      const { sheetRowId, sheetName, tags, leadId, email } = body;

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const availableSheets = meta.sheets?.map(s => s.properties?.title) || [];

      const knownGoodTabsTags = ['Referral Partners', 'Broker Leads', 'Brokers'];
      const targetSheet = availableSheets.includes(sheetName)
        ? sheetName
        : knownGoodTabsTags.find(t => availableSheets.includes(t)) || availableSheets[0] || 'Referral Partners';

      const tabRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet + '!A:Z')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const tabData = await tabRes.json();
      const allRows = tabData.values || [];
      if (allRows.length === 0) {
        return Response.json({ error: `Tab "${targetSheet}" is empty` }, { status: 400 });
      }

      const headers = (allRows[0] || []).map(h => h.toLowerCase().trim());
      const emailColIdx = headers.findIndex(h => h === 'email' || h === 'email address');
      let tagsColIdx = headers.findIndex(h => h === 'tags' || h === 'tag');

      if (tagsColIdx === -1) {
        // Auto-create the Tags column in the header row
        const updatedHeader = (allRows[0] || []).slice();
        const newColIdx = updatedHeader.length;
        updatedHeader.push('Tags');

        const headerRange = `${targetSheet}!1:1`;
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ range: headerRange, majorDimension: 'ROWS', values: [updatedHeader] }),
          }
        );

        tagsColIdx = newColIdx;
      }

      // Find row by email match (case-insensitive, trimmed)
      let matchedRowNum = null;
      if (email && emailColIdx >= 0) {
        const normEmail = email.trim().toLowerCase();
        for (let i = 1; i < allRows.length; i++) {
          const cellEmail = (allRows[i][emailColIdx] || '').trim().toLowerCase();
          if (cellEmail === normEmail) {
            matchedRowNum = i + 1;
            break;
          }
        }
      }

      // Fall back to sheetRowId if no email match
      if (!matchedRowNum && sheetRowId) {
        matchedRowNum = parseInt(sheetRowId, 10);
      }

      if (!matchedRowNum) {
        return Response.json({
          error: `Could not find row for email "${email}" and no sheetRowId provided`,
          targetSheet, email, sheetRowId,
        }, { status: 400 });
      }

      const tagsValue = Array.isArray(tags) ? tags.join(', ') : (tags || '');
      const colLetter = String.fromCharCode(65 + tagsColIdx);
      const cellRange = `${targetSheet}!${colLetter}${matchedRowNum}`;

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: cellRange, majorDimension: 'ROWS', values: [[tagsValue]] }),
        }
      );
      const updateData = await updateRes.json();
      if (updateData.error) {
        return Response.json({ error: updateData.error.message, details: updateData.error }, { status: 400 });
      }

      // Write back the matched row number so sheet_row_id stays fresh
      if (leadId) {
        try {
          await base44.asServiceRole.entities.Lead.update(leadId, {
            sheet_row_id: String(matchedRowNum),
            sheet_origin: `BrokerLeads:${targetSheet}`,
          });
        } catch (e) {
          console.warn('Failed to update sheet_row_id on lead:', e.message);
        }
      }

      return Response.json({ success: true, updatedRange: updateData.updatedRange, cellRange, targetSheet, matchedRowNum });
    }

    // ── Handle appendLead action ───────────────────────────────────────────────
    // Appends a new row for a lead that was created in the app (not from the sheet).
    // Returns { rowNumber } (1-based, including header). If the email already exists
    // in the sheet, returns the existing row number without writing anything.
    if (body.action === 'appendLead') {
      const { name, title, owner, email, company, status, notes, source, phone, industry } = body;
      if (!email) {
        return Response.json({ error: 'email is required for appendLead' }, { status: 400 });
      }

      // Demo records are never synced to Google Sheets
      if (body.is_demo) {
        return Response.json({ success: true, skipped: true, reason: 'demo_record' });
      }

      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

      // Resolve canonical sheet name
      const metaRes2 = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta2 = await metaRes2.json();
      if (meta2.error) {
        return Response.json({ error: `Metadata error: ${meta2.error.message}` }, { status: 400 });
      }
      const tabs2 = meta2.sheets?.map(s => s.properties?.title) || [];
      const knownNames2 = ['Referral Partners', 'Broker Leads', 'Brokers'];
      const targetSheet2 = knownNames2.find(n => tabs2.includes(n)) || tabs2[0] || 'Referral Partners';

      // Read header row
      const hRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet2 + '!1:1')}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const hData = await hRes.json();
      const headerRow2 = hData.values?.[0] || [];
      const colMap2 = {};
      headerRow2.forEach((h, i) => { if (h) colMap2[h.trim().toLowerCase()] = i; });

      // Read entire Email column to check for duplicates
      const emailColIdx = (() => {
        const k = Object.keys(colMap2).find(k => k === 'email' || k === 'email address');
        return k !== undefined ? colMap2[k] : -1;
      })();

      if (emailColIdx >= 0) {
        const colLetter2 = String.fromCharCode(65 + emailColIdx);
        const emailColRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet2 + '!' + colLetter2 + ':' + colLetter2)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const emailColData = await emailColRes.json();
        const emailValues = (emailColData.values || []).map(r => (r[0] || '').trim().toLowerCase());
        const normalizedEmail = email.trim().toLowerCase();
        // Row 0 = header, data starts at row 1 (1-based row 2 including header)
        const existingRowIdx = emailValues.findIndex((e, i) => i > 0 && e === normalizedEmail);
        if (existingRowIdx >= 0) {
          const existingRowNumber = existingRowIdx + 1; // 1-based
          return Response.json({ rowNumber: existingRowNumber, existed: true, targetSheet: targetSheet2 });
        }
      }

      // Build the row to append — map each known field to the correct column
      const fieldMap = {
        'contact name': name || '',
        'name': name || '',
        'full name': name || '',
        'title': title || '',
        'job title': title || '',
        'owner': owner || '',
        'email': email || '',
        'email address': email || '',
        'company': company || '',
        'brokerage': company || '',
        'pipeline stage': ENUM_TO_PIPELINE_STAGE_LABEL[normalizeStatus(status)] || 'New',
        'notes': notes || '',
        'linkedin': source || '',
        'source': source || '',
        'phone': phone || '',
        'phone number': phone || '',
        'industry': industry || '',
        'tags': (body.tags || []).join(', '),
      };

      const newRow = Array(headerRow2.length).fill('');
      headerRow2.forEach((h, i) => {
        const key = (h || '').trim().toLowerCase();
        if (key in fieldMap) newRow[i] = fieldMap[key];
      });

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(targetSheet2 + '!A:A')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ majorDimension: 'ROWS', values: [newRow] }),
        }
      );
      const appendData = await appendRes.json();
      if (appendData.error) {
        return Response.json({ error: appendData.error.message, details: appendData.error }, { status: 400 });
      }

      // Parse the updated range to get the new row number (e.g. "Sheet1!A42:Z42")
      const updatedRange = appendData.updates?.updatedRange || '';
      const rowMatch = updatedRange.match(/!.*?(\d+)/);
      const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : null;

      return Response.json({ rowNumber, existed: false, targetSheet: targetSheet2, updatedRange });
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

    // ── Resilient tab resolution ───────────────────────────────────────────────
    // 1. Prefer the explicitly passed sheetName if it actually exists
    // 2. Fall back to known good names
    // 3. Fall back to any tab whose header contains both 'Contact Name' and 'Follow up Stage'
    const knownGoodNames = ['Referral Partners', 'Broker Leads', 'Brokers'];
    let SHEET_NAME = (body.sheetName && sheetTabs.includes(body.sheetName))
      ? body.sheetName
      : knownGoodNames.find(n => sheetTabs.includes(n)) || null;

    if (!SHEET_NAME) {
      // Scan tab headers as last resort
      const { accessToken: scanToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
      for (const tab of sheetTabs) {
        const hRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tab + '!1:1')}`,
          { headers: { Authorization: `Bearer ${scanToken}` } }
        );
        const hData = await hRes.json();
        const hRow = (hData.values?.[0] || []).map(h => h.toLowerCase());
        if (hRow.some(h => h.includes('contact name')) && hRow.some(h => h.includes('follow up stage'))) {
          SHEET_NAME = tab;
          break;
        }
      }
    }

    if (!SHEET_NAME) {
      return Response.json({ error: 'Could not find a valid broker leads tab', sheetTabs }, { status: 400 });
    }

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

    // Ensure required columns exist in header row
    const requiredColumns = ['Contact Name', 'Owner', 'Email', 'Company', 'Follow Up Stage', 'Title', 'Notes', 'Phone', 'LinkedIn', 'Industry', 'Status', 'Last Contacted', 'Kajabi Contact ID', 'Tags'];
    const missingColumns = requiredColumns.filter(col => !Object.keys(colMap).some(k => k.toLowerCase() === col.toLowerCase()));
    
    // If missing columns, create/update header row
    if (missingColumns.length > 0) {
      console.log('Missing columns detected:', missingColumns);
      // Add missing columns to header
      const updatedHeader = [...headerRow];
      missingColumns.forEach(col => {
        const colIndex = updatedHeader.length;
        colMap[col] = colIndex;
        updatedHeader.push(col);
      });
      
      // Write updated header row back to sheet
      const headerRange = `${SHEET_NAME}!1:1`;
      console.log('Updating header row to:', updatedHeader);
      const headerUpdateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(headerRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range: headerRange, majorDimension: 'ROWS', values: [updatedHeader] }),
        }
      );
      const headerUpdateData = await headerUpdateRes.json();
      if (headerUpdateData.error) {
        console.error('Failed to update header:', headerUpdateData.error);
      } else {
        console.log('Header row updated successfully. New columns added:', missingColumns);
      }
    }

    const dataRows = rows.slice(1); // skip header

    // ── 3. Load ALL broker_lead records regardless of sheet_origin ────────────
    // Matching by email so a tab rename doesn't cause duplicate creation.
    const existingLeads = await base44.asServiceRole.entities.Lead.filter(
      { lead_type: 'broker_lead' }, '-created_date', 1000
    );
    const byEmail = {};
    for (const lead of existingLeads) {
      if (lead.email) byEmail[lead.email.toLowerCase()] = lead;
    }

    // Load ReferralPartners by email for Kajabi Contact ID mapping
    const existingPartners = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 1000);
    const partnerByEmail = {};
    for (const p of existingPartners) {
      if (p.email) partnerByEmail[p.email.toLowerCase()] = p;
    }

    // ── Load deleted contacts blocklist ────────────────────────────────────────
    const deletedContacts = await base44.asServiceRole.entities.DeletedContact.list('-created_date', 1000);
    const deletedEmails = new Set(deletedContacts.map(d => d.email?.toLowerCase()).filter(Boolean));

    let created = 0;
    let updated = 0;

    // Track emails processed in this run to prevent intra-chunk duplicates
    const processedEmails = new Set();

    const chunk = dataRows.slice(startRow, startRow + CHUNK_SIZE);

    // ── 4. One-way: Sheet → App only ───────────────────────────────────────────
    for (let i = 0; i < chunk.length; i++) {
      const rowIndex = startRow + i + 2; // 1-based, row 1 = header
      const lead = rowToLead(chunk[i], rowIndex, sheetOriginKey, colMap);
      if (!lead) continue;

      // Skip contacts that were intentionally deleted from the app
      if (lead.email && deletedEmails.has(lead.email.toLowerCase())) {
        console.log(`Skipping deleted contact: ${lead.email}`);
        continue;
      }

      const emailKey = lead.email.toLowerCase();

      // Skip if already processed in this sync run (prevents intra-run duplicates)
      if (processedEmails.has(emailKey)) {
        console.log(`Skipping duplicate within this sync run: ${lead.email}`);
        continue;
      }
      processedEmails.add(emailKey);

      // Email is the primary key — row number is only used for write-back (never for matching)
      const existing = byEmail[emailKey];

      if (existing) {
        const normalizedAppStatus = normalizeStatus(existing.status);
        const appRank = APP_STATUS_RANK.indexOf(normalizedAppStatus);
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
          ...(lead.owner !== undefined && { owner: lead.owner }),
          // follow_up_stage, follow_up_due_date, partner_status are no longer synced from sheet
          // Tags are write-only — do not overwrite app tags from sheet values
        };
        // Only update status from Pipeline Stage if the cell had a recognized value
        // and it's at the same or higher rank (never downgrade from sheet)
        if (lead._hasPipelineStage && sheetRank >= appRank) {
          updates.status = lead.status;
        }
        console.log('Updating lead from sheet:', updates.name, '| pipeline status:', lead.status);
        await base44.asServiceRole.entities.Lead.update(existing.id, updates);
        updated++;
      } else {
        console.log('Creating lead from sheet:', lead.name, '| pipeline status:', lead.status);
        const newLead = await base44.asServiceRole.entities.Lead.create(lead);
        // Register in byEmail so subsequent rows in the same chunk don't duplicate
        if (newLead?.id) byEmail[emailKey] = newLead;
        created++;
      }

      // Map Kajabi Contact ID from sheet → ReferralPartner
      const kajabiColKey = Object.keys(colMap).find(k => k.toLowerCase() === 'kajabi contact id');
      if (kajabiColKey !== undefined) {
        const sheetKajabiId = (chunk[i][colMap[kajabiColKey]] || '').trim();
        if (sheetKajabiId) {
          const partner = partnerByEmail[emailKey];
          if (partner && partner.kajabi_contact_id !== sheetKajabiId) {
            await base44.asServiceRole.entities.ReferralPartner.update(partner.id, { kajabi_contact_id: sheetKajabiId });
            console.log(`Updated ReferralPartner ${partner.name} kajabi_contact_id from sheet: ${sheetKajabiId}`);
          }
        }
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