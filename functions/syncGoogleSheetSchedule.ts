import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const spreadsheetId = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
    const range = 'Sheet1'; // Adjust if needed
    
    // Get access token from app connector
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    
    // Fetch data from Google Sheets
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: 'Failed to fetch sheet data', details: error }, { status: response.status });
    }

    const data = await response.json();
    
    // Transform sheet data into structured format
    // Assuming first row is headers
    const rows = data.values || [];
    if (rows.length === 0) {
      return Response.json({ events: [] });
    }

    const headers = rows[0];
    const events = rows.slice(1).map(row => {
      const event = {};
      headers.forEach((header, index) => {
        event[header] = row[index] || '';
      });
      return event;
    });

    return Response.json({ events, lastUpdated: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});