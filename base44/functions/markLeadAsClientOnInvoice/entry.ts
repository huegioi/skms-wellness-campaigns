import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SPREADSHEET_ID = '1qK6sAv73EkBPfES1i--b2u1AanUt_Gu3_7yyth99OBA';
const SHEET_NAME = 'Brokers';
const STATUS_COL = 'I'; // Column index 8 (0-based), letter I

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Support both direct invocation and entity automation payload
    const invoice = body.data || body;
    const email = invoice?.client_email?.toLowerCase();

    if (!email) {
      return Response.json({ skipped: true, reason: 'No client_email on invoice' });
    }

    // Find matching lead by email
    const leads = await base44.asServiceRole.entities.Lead.list();
    const matchingLead = leads.find(l => l.email?.toLowerCase() === email);

    if (!matchingLead) {
      return Response.json({ skipped: true, reason: 'No lead found with email: ' + email });
    }

    // Already marked as current_client - no-op
    if (matchingLead.status === 'current_client') {
      return Response.json({ skipped: true, reason: 'Lead already marked as current_client' });
    }

    // Update Lead status in DB
    await base44.asServiceRole.entities.Lead.update(matchingLead.id, { status: 'current_client' });

    // Update Google Sheet row if we have the row id
    if (matchingLead.sheet_row_id) {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
      const rowNum = matchingLead.sheet_row_id;
      const range = encodeURIComponent(`${SHEET_NAME}!${STATUS_COL}${rowNum}`);

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['Client']] }),
        }
      );
    }

    return Response.json({
      success: true,
      leadId: matchingLead.id,
      leadName: matchingLead.name,
      email,
      sheetRowUpdated: !!matchingLead.sheet_row_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});