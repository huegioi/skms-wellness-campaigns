import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';
const DEFAULT_TAB_NAME = 'Referral Partners';
const CHUNK_SIZE = 50;


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Unauthorized — team only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sheetName = body.sheetName || DEFAULT_TAB_NAME;
    const startRow = body.startRow || 0;
    const encodedTab = encodeURIComponent(sheetName);

    // 1. Get googlesheets access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 2. Read the full target tab — header row + all data rows
    const tabRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!A:Z`,
      { headers: authHeaders }
    );
    if (!tabRes.ok) {
      const errText = await tabRes.text();
      return Response.json({ error: 'Failed to read sheet', details: errText }, { status: 502 });
    }
    const tabData = await tabRes.json();
    const allRows = tabData.values || [];
    if (allRows.length === 0) {
      return Response.json({ error: `Tab "${sheetName}" is empty or not found` }, { status: 400 });
    }

    const headerRow = allRows[0] || [];
    const colMap = {};
    headerRow.forEach((h, i) => {
      const lower = (h || '').trim().toLowerCase();
      if (!colMap[lower]) colMap[lower] = i;
    });
    const numCols = headerRow.length;

    // Build set of existing emails in the sheet (lowercased) — find the Email column
    const emailColIdx = colMap['email'];
    const existingEmails = new Set();
    if (emailColIdx !== undefined) {
      for (let i = 1; i < allRows.length; i++) {
        const val = (allRows[i][emailColIdx] || '').trim().toLowerCase();
        if (val) existingEmails.add(val);
      }
    }

    // 3. Load DeletedContact emails into a skip-set
    const deletedContacts = await base44.asServiceRole.entities.DeletedContact.list('-created_date', 500);
    const deletedEmails = new Set(
      deletedContacts.map(d => (d.email || '').trim().toLowerCase()).filter(Boolean)
    );

    // 4. Load all Lead records — broker + broker_lead types, paginated
    const brokers = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker' }, '-created_date', 1000);
    const brokerLeads = await base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }, '-created_date', 1000);
    const allLeads = [...brokers, ...brokerLeads];

    // 5. Filter: skip if no email, deleted, already has sheet_row_id, or email already in sheet
    const eligible = [];
    let skipped = 0;
    for (const lead of allLeads) {
      const normEmail = (lead.email || '').trim().toLowerCase();
      if (!normEmail) { skipped++; continue; }
      if (deletedEmails.has(normEmail)) { skipped++; continue; }
      if (lead.is_demo) { skipped++; continue; }
      if (lead.sheet_row_id) { skipped++; continue; }
      if (existingEmails.has(normEmail)) { skipped++; continue; }
      eligible.push(lead);
    }

    // 6. Process in chunks of CHUNK_SIZE starting at startRow
    const chunk = eligible.slice(startRow, startRow + CHUNK_SIZE);
    const hasMore = startRow + CHUNK_SIZE < eligible.length;
    const nextStartRow = startRow + CHUNK_SIZE;

    if (chunk.length === 0) {
      return Response.json({
        appended: 0,
        skipped,
        hasMore: false,
        nextStartRow: 0,
        eligible_total: eligible.length,
      });
    }

    // 7. Build row arrays positioned by the header map
    const setCol = (rowArr, colName, value) => {
      const idx = colMap[colName.toLowerCase()];
      if (idx !== undefined) {
        rowArr[idx] = value || '';
      }
    };

    const rowsToAppend = chunk.map(lead => {
      const row = new Array(numCols).fill('');
      setCol(row, 'Contact Name', lead.name);
      setCol(row, 'Title', lead.title);
      setCol(row, 'Owner', lead.owner);
      setCol(row, 'Email', lead.email);
      setCol(row, 'Email 2', lead.email2);
      setCol(row, 'Company', lead.company);
      setCol(row, 'Notes', lead.notes);
      setCol(row, 'LinkedIn', lead.source);
      setCol(row, 'Phone', lead.phone);
      setCol(row, 'Address', lead.address);
      setCol(row, 'Industry', lead.industry);
      setCol(row, 'Status', lead.status);
      setCol(row, 'Last Contacted', lead.last_contacted_date);
      setCol(row, 'Kajabi Contact ID', lead.kajabi_contact_id);
      setCol(row, 'Follow Up Stage', lead.follow_up_stage);
      setCol(row, 'Follow Up Due Date', lead.follow_up_due_date);
      setCol(row, 'Lead Type', lead.lead_type);
      setCol(row, 'Partner Status', lead.partner_status);
      setCol(row, 'Outreach Channel', lead.outreach_channel);
      setCol(row, 'Tags', (lead.tags || []).join(', '));
      return row;
    });

    // 8. Batched append
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rowsToAppend }),
      }
    );

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      return Response.json({ error: 'Sheets API append failed', details: errText }, { status: 502 });
    }

    const appendResult = await appendRes.json();
    const updatedRange = appendResult.updates?.updatedRange || '';

    // 9. Re-read the tab to find each appended email's new row number
    const reReadRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!A:Z`,
      { headers: authHeaders }
    );
    const reReadData = await reReadRes.json();
    const reReadRows = reReadData.values || [];

    // Build email → row number map from the full tab
    const emailToRowNum = {};
    if (emailColIdx !== undefined) {
      for (let i = 1; i < reReadRows.length; i++) {
        const val = (reReadRows[i][emailColIdx] || '').trim().toLowerCase();
        if (val && !emailToRowNum[val]) {
          emailToRowNum[val] = String(i + 1); // 1-based row number
        }
      }
    }

    // 10. Write sheet_row_id + sheet_origin back onto each Lead in the chunk
    const sheetOrigin = `BrokerLeads:${sheetName}`;
    const updateBatch = chunk
      .map(lead => {
        const normEmail = (lead.email || '').trim().toLowerCase();
        const rowNum = emailToRowNum[normEmail];
        if (!rowNum) return null;
        return { id: lead.id, sheet_row_id: rowNum, sheet_origin: sheetOrigin };
      })
      .filter(Boolean);

    if (updateBatch.length > 0) {
      await base44.asServiceRole.entities.Lead.bulkUpdate(updateBatch);
    }

    return Response.json({
      appended: chunk.length,
      skipped,
      hasMore,
      nextStartRow: hasMore ? nextStartRow : 0,
      eligible_total: eligible.length,
      updated_range: updatedRange,
      leads_updated: updateBatch.length,
    });

  } catch (error) {
    console.error('backfillLeadsToSheet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});