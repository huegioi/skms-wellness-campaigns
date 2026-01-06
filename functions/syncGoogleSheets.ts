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

    // Fetch spreadsheet with full data using includeGridData
    const fullDataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true`;
    const fullDataResponse = await fetch(fullDataUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!fullDataResponse.ok) {
      const errorData = await fullDataResponse.text();
      return Response.json({ 
        error: 'Failed to fetch spreadsheet data', 
        details: errorData 
      }, { status: fullDataResponse.status });
    }

    const fullData = await fullDataResponse.json();

    // Process all sheets with grid data
    const allSheets = fullData.sheets.map(sheet => {
      const sheetData = sheet.data?.[0];
      const rows = sheetData?.rowData || [];
      
      // Always use first row as headers
      const headers = rows[0]?.values?.map(cell => 
        cell.effectiveValue?.stringValue || 
        cell.formattedValue || 
        ''
      ).filter(h => h !== '') || [];
      
      const dataRows = rows.slice(1);
      
      // Extract data rows
      const data = dataRows.map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
          const cell = row.values?.[index];
          if (!cell) {
            rowData[header] = '';
            return;
          }
          const value = cell.effectiveValue?.stringValue || 
                       cell.effectiveValue?.numberValue?.toString() || 
                       cell.effectiveValue?.boolValue?.toString() ||
                       cell.formattedValue || 
                       '';
          rowData[header] = value;
        });
        return rowData;
      }).filter(row => Object.values(row).some(val => val !== ''));

      return {
        name: sheet.properties.title,
        headers: headers.filter(h => h !== ''),
        data
      };
    });

    return Response.json({ 
      success: true,
      spreadsheetId,
      title: fullData.properties.title,
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