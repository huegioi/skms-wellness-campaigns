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
    
    // Hardcoded spreadsheet ID for the scheduling sheet
    const spreadsheetId = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';

    // Fetch spreadsheet metadata to get all sheets
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.text();
      return Response.json({ 
        error: 'Failed to fetch spreadsheet metadata', 
        details: errorData 
      }, { status: metadataResponse.status });
    }

    const metadata = await metadataResponse.json();
    const sheetNames = metadata.sheets.map(sheet => sheet.properties.title);

    // Fetch data from all sheets
    const allSheets = await Promise.all(
      sheetNames.map(async (sheetName) => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          return { name: sheetName, headers: [], data: [], error: 'Failed to fetch' };
        }

        const data = await response.json();
        const rows = data.values || [];
        const headers = rows[0] || [];
        const sheetData = rows.slice(1).map(row => {
          const item = {};
          headers.forEach((header, index) => {
            item[header] = row[index] || '';
          });
          return item;
        }).filter(row => Object.values(row).some(val => val !== ''));

        return {
          name: sheetName,
          headers,
          data: sheetData
        };
      })
    );

    return Response.json({ 
      success: true,
      spreadsheetId,
      title: metadata.properties.title,
      sheets: allSheets,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ 
      error: 'Server error', 
      message: error.message 
    }, { status: 500 });
  }
});