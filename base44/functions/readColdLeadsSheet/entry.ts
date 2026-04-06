import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SPREADSHEET_ID = '1qK6sAv73EkBPfES1i--b2u1AanUt_Gu3_7yyth99OBA';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // First get spreadsheet metadata to find tab names
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const firstSheet = meta.sheets?.[0]?.properties?.title || 'Sheet1';

    // Read first 5 rows
    const range = encodeURIComponent(`${firstSheet}!A1:Z5`);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return Response.json({ sheetTabs: meta.sheets?.map(s => s.properties?.title), firstSheet, data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});