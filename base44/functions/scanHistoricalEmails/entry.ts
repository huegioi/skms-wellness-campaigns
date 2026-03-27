import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
const MAX_RESULTS = 500; // Adjust as needed for history depth

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Fetch all clients
    const clients = await base44.asServiceRole.entities.Client.list();

    // Build a map of email -> client (including related_contacts emails)
    const emailToClient = {};
    for (const client of clients) {
      if (client.email) emailToClient[client.email.toLowerCase()] = client;
      for (const contact of client.related_contacts || []) {
        if (contact.email) emailToClient[contact.email.toLowerCase()] = client;
      }
    }

    // Fetch historical emails from Gmail
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${MAX_RESULTS}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listData.messages) {
      return Response.json({ message: 'No emails found', updated: 0 });
    }

    // Track updates: clientId -> most recent date found
    const clientUpdates = {};

    for (const { id } of listData.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const dateStr = get('Date');
      if (!dateStr) continue;
      const emailDate = new Date(dateStr);
      if (isNaN(emailDate.getTime())) continue;

      const dateOnly = emailDate.toISOString().split('T')[0];

      // Extract all emails from From, To, Cc
      const allAddresses = [get('From'), get('To'), get('Cc')]
        .join(',')
        .match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];

      for (const addr of allAddresses) {
        const lower = addr.toLowerCase();
        const client = emailToClient[lower];
        if (!client) continue;

        // Skip if this is the SKMS email itself
        if (lower.includes('skillfulmeans')) continue;

        // Keep the most recent date per client
        if (!clientUpdates[client.id] || dateOnly > clientUpdates[client.id]) {
          clientUpdates[client.id] = dateOnly;
        }
      }
    }

    // Apply updates only if the new date is more recent than stored
    let updatedCount = 0;
    for (const [clientId, newDate] of Object.entries(clientUpdates)) {
      const client = clients.find(c => c.id === clientId);
      if (!client) continue;

      const existingDate = client.last_contacted_date;
      if (!existingDate || newDate > existingDate) {
        await base44.asServiceRole.entities.Client.update(clientId, {
          last_contacted_date: newDate
        });
        updatedCount++;
        console.log(`Updated ${client.name} (${client.email}): ${existingDate || 'none'} → ${newDate}`);
      }
    }

    return Response.json({
      message: 'Historical email scan complete',
      emailsScanned: listData.messages.length,
      clientsUpdated: updatedCount
    });
  } catch (error) {
    console.error('Scan error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});