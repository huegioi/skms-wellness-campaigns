import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    
    if (!accessToken) {
      return Response.json({ error: 'Google Sheets not connected' }, { status: 400 });
    }

    const spreadsheetId = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
    
    // Fetch the spreadsheet data
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Google Sheets API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    
    // Extract sheet data into a more usable format
    const sheets = data.sheets.map(sheet => {
      const sheetData = sheet.data[0];
      const rows = sheetData.rowData || [];
      
      // Get headers from first row
      const headers = rows[0]?.values?.map(cell => 
        cell.formattedValue || ''
      ) || [];
      
      // Get data rows
      const dataRows = rows.slice(1).map(row => {
        const rowData = {};
        row.values?.forEach((cell, index) => {
          const header = headers[index] || `Column${index}`;
          rowData[header] = cell.formattedValue || '';
        });
        return rowData;
      }).filter(row => Object.values(row).some(val => val !== ''));
      
      return {
        name: sheet.properties.title,
        headers,
        data: dataRows
      };
    });

    return Response.json({
      spreadsheetId,
      title: data.properties.title,
      sheets,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});