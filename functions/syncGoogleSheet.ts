import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    
    if (!accessToken) {
      return Response.json({ 
        error: 'Google Sheets not authorized. Please connect your Google account.' 
      }, { status: 401 });
    }

    // Fetch all sheets in the spreadsheet
    const spreadsheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!spreadsheetResponse.ok) {
      const error = await spreadsheetResponse.text();
      return Response.json({ 
        error: 'Failed to fetch spreadsheet', 
        details: error 
      }, { status: spreadsheetResponse.status });
    }

    const spreadsheetData = await spreadsheetResponse.json();
    const sheets = spreadsheetData.sheets || [];

    // Fetch data from all sheets
    const allSheetsData = [];
    
    for (const sheet of sheets) {
      const sheetTitle = sheet.properties.title;
      
      const valuesResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (valuesResponse.ok) {
        const valuesData = await valuesResponse.json();
        allSheetsData.push({
          sheetTitle,
          data: valuesData.values || []
        });
      }
    }

    return Response.json({
      spreadsheetTitle: spreadsheetData.properties?.title || 'Schedule',
      sheets: allSheetsData,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});