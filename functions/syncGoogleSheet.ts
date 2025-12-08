import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    // Extract spreadsheet ID and range from the URL
    const spreadsheetId = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
    const range = 'Sheet1'; // Fetch all data from Sheet1

    // Fetch data from Google Sheets
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Google Sheets API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    
    // Parse the data into structured format
    // Assuming first row is headers
    const rows = data.values || [];
    if (rows.length === 0) {
      return Response.json({ schedules: [] });
    }

    const headers = rows[0];
    const schedules = rows.slice(1).map((row, index) => {
      const schedule = { id: index };
      headers.forEach((header, i) => {
        schedule[header] = row[i] || '';
      });
      return schedule;
    });

    return Response.json({ schedules, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});