import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get access token from Google Sheets connector
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    
    // Extract spreadsheet ID and range from request
    const { spreadsheetId, range } = await req.json();
    
    if (!spreadsheetId) {
      return Response.json({ error: 'Spreadsheet ID is required' }, { status: 400 });
    }

    // Fetch data from Google Sheets
    const sheetRange = range || 'Sheet1';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetRange}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      return Response.json({ 
        error: 'Failed to fetch sheet data', 
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Transform rows into structured data
    const rows = data.values || [];
    const headers = rows[0] || [];
    const scheduleData = rows.slice(1).map(row => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index] || '';
      });
      return item;
    });

    return Response.json({ 
      success: true,
      headers,
      data: scheduleData,
      rawRows: data.values
    });

  } catch (error) {
    return Response.json({ 
      error: 'Server error', 
      message: error.message 
    }, { status: 500 });
  }
});