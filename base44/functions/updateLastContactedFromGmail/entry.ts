import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const messageIds = body.data?.new_message_ids ?? [];
    if (messageIds.length === 0) {
      return Response.json({ message: 'No new messages to process' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Load all clients once
    const clients = await base44.asServiceRole.entities.Client.list();

    // Build a map of email (lowercase) -> client
    const emailToClient = {};
    for (const client of clients) {
      if (client.email) {
        emailToClient[client.email.toLowerCase()] = client;
      }
    }

    for (const messageId of messageIds) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const message = await res.json();

      const headers = message.payload?.headers || [];
      const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const fromVal = get('From').toLowerCase();
      const toVal = get('To').toLowerCase();
      const dateStr = get('Date');
      if (!dateStr) continue;

      const emailDate = new Date(dateStr);
      if (isNaN(emailDate.getTime())) continue;

      const emailDateStr = emailDate.toISOString().split('T')[0];

      // Find a matching client in From or To fields
      let matchedClient = null;
      for (const [clientEmail, client] of Object.entries(emailToClient)) {
        if (fromVal.includes(clientEmail) || toVal.includes(clientEmail)) {
          matchedClient = client;
          break;
        }
      }

      if (!matchedClient) continue;

      // Only update if this date is more recent than what's stored
      const existing = matchedClient.last_contacted_date;
      if (!existing || emailDateStr > existing) {
        await base44.asServiceRole.entities.Client.update(matchedClient.id, {
          last_contacted_date: emailDateStr
        });
        console.log(`Updated last_contacted_date for ${matchedClient.name} to ${emailDateStr} (from Gmail)`);
        // Update our local map so subsequent messages in same batch use fresh data
        emailToClient[matchedClient.email.toLowerCase()].last_contacted_date = emailDateStr;
      }
    }

    return Response.json({ message: 'Processed', count: messageIds.length });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});