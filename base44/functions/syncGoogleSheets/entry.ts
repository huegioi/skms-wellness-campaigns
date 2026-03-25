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

    // Handle update requests
    const body = await req.json().catch(() => ({}));
    if (body.action === 'update') {
      const { sheetName, rowIndex, columnIndex, value, headerRowIndex } = body;
      
      // Convert column index to A1 notation (A, B, C, etc.)
      const columnLetter = String.fromCharCode(65 + columnIndex);
      // Account for header row: actual row = headerRowIndex + 1 (skip header) + rowIndex + 1 (1-based indexing)
      const actualRow = (headerRowIndex || 0) + rowIndex + 2;
      const range = `${sheetName}!${columnLetter}${actualRow}`;
      
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [[value]]
          })
        }
      );
      
      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        return Response.json({ error: 'Failed to update cell', details: error }, { status: 500 });
      }
      
      return Response.json({ success: true, message: 'Cell updated successfully' });
    }

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
      
      if (rows.length === 0) {
        return {
          name: sheet.properties.title,
          headers: [],
          data: []
        };
      }
      
      // Find first non-empty row as headers - scan more rows
      let headerRowIndex = -1;
      let headers = [];
      
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const potentialHeaders = rows[i]?.values?.map(cell => {
          // Try all possible value types
          const value = cell.effectiveValue?.stringValue || 
                       cell.effectiveValue?.numberValue?.toString() ||
                       cell.userEnteredValue?.stringValue ||
                       cell.formattedValue || 
                       '';
          return value;
        }) || [];
        
        // Check if this row has actual text values (likely headers)
        const nonEmpty = potentialHeaders.filter(h => h && h.toString().trim() !== '');
        if (nonEmpty.length >= 2) { // At least 2 headers
          headers = potentialHeaders;
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex === -1 || headers.length === 0) {
        return {
          name: sheet.properties.title,
          headers: [],
          data: []
        };
      }
      
      const dataRows = rows.slice(headerRowIndex + 1);
      
      // Extract data rows
      const data = dataRows.map(row => {
        if (!row.values || row.values.length === 0) return null;
        
        const rowData = {};
        let hasData = false;
        
        headers.forEach((header, index) => {
          if (!header || header.toString().trim() === '') return;
          
          const cell = row.values?.[index];
          if (!cell) {
            rowData[header] = '';
            return;
          }
          
          // Handle different cell types properly
          let value = '';
          if (cell.effectiveValue) {
            if (cell.effectiveValue.stringValue !== undefined) {
              value = cell.effectiveValue.stringValue;
            } else if (cell.effectiveValue.numberValue !== undefined) {
              const num = cell.effectiveValue.numberValue;
              // Check if it's a date serial number (dates > 40000)
              if (num > 40000 && num < 60000) {
                // Use formatted value for dates
                value = cell.formattedValue || num.toString();
              } else if (num > 0 && num < 1) {
                // Time value (fraction of a day) - use formatted value
                value = cell.formattedValue || num.toString();
              } else {
                value = num.toString();
              }
            } else if (cell.effectiveValue.boolValue !== undefined) {
              value = cell.effectiveValue.boolValue.toString();
            } else if (cell.formattedValue) {
              value = cell.formattedValue;
            }
          } else if (cell.formattedValue) {
            value = cell.formattedValue;
          }
          
          if (value) hasData = true;
          rowData[header] = value;
        });
        
        return hasData ? rowData : null;
      }).filter(row => row !== null);

      return {
        name: sheet.properties.title,
        headers: headers.filter(h => h && h.trim() !== ''),
        data,
        headerRowIndex: headerRowIndex
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