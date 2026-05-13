import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');
    const spreadsheetId = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';

    const body = await req.json().catch(() => ({}));

    // Handle cell update
    if (body.action === 'update') {
      const { sheetName, rowIndex, columnIndex, value, headerRowIndex } = body;
      const columnLetter = String.fromCharCode(65 + columnIndex);
      const actualRow = (headerRowIndex || 0) + rowIndex + 2;
      const range = `${sheetName}!${columnLetter}${actualRow}`;

      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[value]] })
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        return Response.json({ error: 'Failed to update cell', details: error }, { status: 500 });
      }
      return Response.json({ success: true, message: 'Cell updated successfully' });
    }

    // Step 1: Get sheet names only (lightweight metadata call)
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      const errorData = await metaResponse.text();
      return Response.json({ error: 'Failed to fetch spreadsheet metadata', details: errorData }, { status: metaResponse.status });
    }

    const meta = await metaResponse.json();
    const sheetNames = meta.sheets.map(s => s.properties.title);

    // Step 2: Batch fetch all sheet values (raw values only — much faster than includeGridData)
    const ranges = sheetNames.map(name => encodeURIComponent(name));
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}&valueRenderOption=FORMATTED_VALUE`;

    const batchResponse = await fetch(batchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!batchResponse.ok) {
      const errorData = await batchResponse.text();
      return Response.json({ error: 'Failed to fetch sheet values', details: errorData }, { status: batchResponse.status });
    }

    const batchData = await batchResponse.json();

    // Step 3: Process each sheet's values into headers + data rows
    const allSheets = (batchData.valueRanges || []).map((vr, i) => {
      const rows = vr.values || [];
      const name = sheetNames[i];

      if (rows.length === 0) return { name, headers: [], data: [], headerRowIndex: 0 };

      // Find first row with at least 2 non-empty cells as header
      let headerRowIndex = -1;
      let headers = [];
      for (let r = 0; r < Math.min(10, rows.length); r++) {
        const nonEmpty = (rows[r] || []).filter(c => c && c.toString().trim() !== '');
        if (nonEmpty.length >= 2) {
          headers = rows[r];
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) return { name, headers: [], data: [], headerRowIndex: 0 };

      const cleanHeaders = headers.map(h => (h || '').toString().trim());

      const data = rows.slice(headerRowIndex + 1).map(row => {
        const rowData = {};
        let hasData = false;
        cleanHeaders.forEach((header, idx) => {
          if (!header) return;
          const val = (row[idx] || '').toString();
          if (val) hasData = true;
          rowData[header] = val;
        });
        return hasData ? rowData : null;
      }).filter(r => r !== null);

      return {
        name,
        headers: cleanHeaders.filter(h => h),
        data,
        headerRowIndex
      };
    });

    return Response.json({
      success: true,
      spreadsheetId,
      title: meta.properties.title,
      sheets: allSheets,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ error: 'Server error', message: error.message }, { status: 500 });
  }
});