import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // First, get the spreadsheet metadata to find all sheet names
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const sheets = meta.sheets || [];
    console.log('Sheets found:', sheets.map(s => s.properties.title));

    // Fetch all clients
    const clients = await base44.asServiceRole.entities.Client.list();

    // Build lookup maps: email -> client, company name -> client
    const emailToClient = {};
    const nameToClient = {};
    const companyToClient = {};

    for (const client of clients) {
      if (client.email) emailToClient[client.email.toLowerCase().trim()] = client;
      if (client.name) nameToClient[client.name.toLowerCase().trim()] = client;
      if (client.company) companyToClient[client.company.toLowerCase().trim()] = client;
      for (const contact of client.related_contacts || []) {
        if (contact.email) emailToClient[contact.email.toLowerCase().trim()] = client;
        if (contact.name) nameToClient[contact.name.toLowerCase().trim()] = client;
      }
    }

    // Track updates: clientId -> most recent date found
    const clientUpdates = {};
    const debugRows = [];

    // Process each sheet tab
    for (const sheet of sheets) {
      const sheetName = sheet.properties.title;
      const rangeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const rangeData = await rangeRes.json();
      const rows = rangeData.values || [];
      if (rows.length < 2) continue;

      const headers = rows[0].map(h => h?.toLowerCase()?.trim() || '');
      console.log(`Sheet "${sheetName}" headers:`, headers);

      // Find relevant column indices — flexible header matching
      const dateColIdx = headers.findIndex(h =>
        h.includes('date') || h.includes('session') || h.includes('appointment') || h.includes('event') || h.includes('outreach')
      );
      const emailColIdx = headers.findIndex(h => h.includes('email'));
      const nameColIdx = headers.findIndex(h =>
        h.includes('name') || h.includes('client') || h.includes('contact') || h.includes('company')
      );

      if (dateColIdx === -1) {
        console.log(`Sheet "${sheetName}": no date column found, skipping`);
        continue;
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawDate = row[dateColIdx];
        if (!rawDate) continue;

        // Parse the date — handle multiple formats
        let parsedDate = null;
        // Try MM/DD/YYYY
        const mdyMatch = rawDate.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
        if (mdyMatch) {
          const [, month, day, year] = mdyMatch;
          const fullYear = year.length === 2 ? `20${year}` : year;
          parsedDate = new Date(`${fullYear}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`);
        } else {
          parsedDate = new Date(rawDate);
        }

        if (!parsedDate || isNaN(parsedDate.getTime())) continue;

        const dateOnly = parsedDate.toISOString().split('T')[0];

        // Try to find matching client
        let matchedClient = null;

        if (emailColIdx !== -1 && row[emailColIdx]) {
          const email = row[emailColIdx].toLowerCase().trim();
          matchedClient = emailToClient[email];
        }

        if (!matchedClient && nameColIdx !== -1 && row[nameColIdx]) {
          const nameVal = row[nameColIdx].toLowerCase().trim();
          matchedClient = nameToClient[nameVal] || companyToClient[nameVal];

          // Partial match on company name
          if (!matchedClient) {
            for (const [company, client] of Object.entries(companyToClient)) {
              if (nameVal.includes(company) || company.includes(nameVal)) {
                matchedClient = client;
                break;
              }
            }
          }
        }

        if (!matchedClient) continue;

        debugRows.push({
          sheet: sheetName,
          row: i + 1,
          client: matchedClient.name,
          date: dateOnly
        });

        if (!clientUpdates[matchedClient.id] || dateOnly > clientUpdates[matchedClient.id]) {
          clientUpdates[matchedClient.id] = dateOnly;
        }
      }
    }

    // Apply updates only if the new date is more recent than stored
    let updatedCount = 0;
    const updateLog = [];
    for (const [clientId, newDate] of Object.entries(clientUpdates)) {
      const client = clients.find(c => c.id === clientId);
      if (!client) continue;

      const existingDate = client.last_contacted_date;
      if (!existingDate || newDate > existingDate) {
        await base44.asServiceRole.entities.Client.update(clientId, {
          last_contacted_date: newDate
        });
        updatedCount++;
        updateLog.push({ client: client.name, from: existingDate || 'none', to: newDate });
        console.log(`Updated ${client.name}: ${existingDate || 'none'} → ${newDate}`);
      }
    }

    return Response.json({
      message: 'Google Sheet scan complete',
      sheetsScanned: sheets.length,
      rowsMatched: debugRows.length,
      clientsUpdated: updatedCount,
      updates: updateLog,
      matchedRows: debugRows
    });
  } catch (error) {
    console.error('Sheet scan error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});