import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SPREADSHEET_ID = '1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk';
const DEFAULT_TAB_NAME = 'Referral Partners';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Support both direct calls ({ leadId }) and entity automation triggers ({ event: { entity_id } })
    const leadId = body.leadId || body.event?.entity_id;
    const sheetName = body.sheetName;
    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400 });
    }

    const tabName = sheetName || DEFAULT_TAB_NAME;
    const encodedTab = encodeURIComponent(tabName);

    // 1. Load the Lead record
    const lead = await base44.asServiceRole.entities.Lead.get(leadId);
    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Demo records are never synced to Google Sheets
    if (lead.is_demo) {
      return Response.json({ success: true, skipped: true, reason: 'demo_record' });
    }

    // 2. If it already has a sheet_row_id, return early (already in the sheet)
    if (lead.sheet_row_id) {
      return Response.json({ success: true, already_in_sheet: true, sheet_row_id: lead.sheet_row_id, sheet_origin: lead.sheet_origin });
    }

    // 3. Get the googlesheets connection access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 4. Verify the tab exists
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
      { headers: authHeaders }
    );
    const meta = await metaRes.json();
    const tabTitles = meta.sheets?.map(s => s.properties?.title) || [];
    if (!tabTitles.includes(tabName)) {
      return Response.json({
        error: `Tab "${tabName}" not found in spreadsheet. Available tabs: ${tabTitles.join(', ')}`,
      }, { status: 400 });
    }

    // 5. Read the header row and build a name→column index map (case-insensitive)
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!1:1`,
      { headers: authHeaders }
    );
    const headerData = await headerRes.json();
    const headerRow = headerData.values?.[0] || [];
    const colMap = {};
    headerRow.forEach((h, i) => {
      const lower = (h || '').trim().toLowerCase();
      if (!colMap[lower]) colMap[lower] = i;
    });
    const numCols = headerRow.length;

    // 6. Build a row array positioned by those columns from the lead's fields
    const row = new Array(numCols).fill('');

    const setCol = (colName, value) => {
      const idx = colMap[colName.toLowerCase()];
      if (idx !== undefined) {
        row[idx] = value || '';
      }
    };

    setCol('Contact Name', lead.name);
    setCol('Title', lead.title);
    setCol('Owner', lead.owner);
    setCol('Email', lead.email);
    setCol('Email 2', lead.email2);
    setCol('Company', lead.company);
    setCol('Notes', lead.notes);
    setCol('LinkedIn', lead.source);
    setCol('Phone', lead.phone);
    setCol('Address', lead.address);
    setCol('Industry', lead.industry);
    setCol('Status', lead.status);
    setCol('Last Contacted', lead.last_contacted_date);
    setCol('Kajabi Contact ID', lead.kajabi_contact_id);
    setCol('Follow Up Stage', lead.follow_up_stage);
    setCol('Follow Up Due Date', lead.follow_up_due_date);
    setCol('Lead Type', lead.lead_type);
    setCol('Partner Status', lead.partner_status);
    setCol('Outreach Channel', lead.outreach_channel);
    setCol('Tags', (lead.tags || []).join(', '));

    // 7. Append using the Sheets API
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTab}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      }
    );

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      return Response.json({ error: 'Sheets API append failed', details: errText }, { status: 502 });
    }

    const appendResult = await appendRes.json();
    const updatedRange = appendResult.updates?.updatedRange || '';

    // 8. Parse the 1-based row number from the updatedRange (e.g. "Referral Partners!A5:R5")
    let sheetRowId = '';
    const rangeMatch = updatedRange.match(/!A?(\d+):/);
    if (rangeMatch) {
      sheetRowId = rangeMatch[1];
    }

    // 9. Update the Lead with sheet_row_id and sheet_origin
    const sheetOrigin = `BrokerLeads:${tabName}`;
    await base44.asServiceRole.entities.Lead.update(leadId, {
      sheet_row_id: sheetRowId,
      sheet_origin: sheetOrigin,
    });

    return Response.json({
      success: true,
      sheet_row_id: sheetRowId,
      sheet_origin: sheetOrigin,
      updatedRange,
    });

  } catch (error) {
    console.error('appendLeadToSheet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});