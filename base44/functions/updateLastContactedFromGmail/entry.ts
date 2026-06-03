import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Fetch recent messages (last 500) to find last contact dates
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500',
      { headers: authHeader }
    );
    if (!listRes.ok) throw new Error('Failed to fetch Gmail messages');
    const listData = await listRes.json();
    const messages = listData.messages || [];

    // Load all leads and clients
    const [leads, clients] = await Promise.all([
      base44.asServiceRole.entities.Lead.list(),
      base44.asServiceRole.entities.Client.list()
    ]);

    // Build email -> lead map (primary + secondary email)
    const emailToLead = {};
    for (const lead of leads) {
      if (lead.email) emailToLead[lead.email.toLowerCase()] = lead;
      if (lead.email2) emailToLead[lead.email2.toLowerCase()] = lead;
    }

    // Build email -> client map (primary + all related_contacts emails)
    const emailToClient = {};
    for (const client of clients) {
      if (client.email) emailToClient[client.email.toLowerCase()] = client;
      // Also index any related contact emails
      for (const contact of (client.related_contacts || [])) {
        if (contact.email) emailToClient[contact.email.toLowerCase()] = client;
      }
    }

    // Track best (most recent) contact date per lead/client id
    const leadBestDate = {};
    const clientBestDate = {};

    for (const msg of messages) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
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

      // Check leads
      for (const [email, lead] of Object.entries(emailToLead)) {
        if (fromVal.includes(email) || toVal.includes(email)) {
          if (!leadBestDate[lead.id] || emailDateStr > leadBestDate[lead.id]) {
            leadBestDate[lead.id] = emailDateStr;
          }
        }
      }

      // Check clients
      for (const [email, client] of Object.entries(emailToClient)) {
        if (fromVal.includes(email) || toVal.includes(email)) {
          if (!clientBestDate[client.id] || emailDateStr > clientBestDate[client.id]) {
            clientBestDate[client.id] = emailDateStr;
          }
        }
      }
    }

    let updated = 0;

    // Update leads
    for (const [leadId, bestDate] of Object.entries(leadBestDate)) {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) continue;
      if (!lead.last_contacted_date || bestDate > lead.last_contacted_date) {
        await base44.asServiceRole.entities.Lead.update(leadId, { last_contacted_date: bestDate });
        console.log(`Updated Lead ${lead.name} last_contacted_date -> ${bestDate}`);
        updated++;
      }
    }

    // Update clients
    for (const [clientId, bestDate] of Object.entries(clientBestDate)) {
      const client = clients.find(c => c.id === clientId);
      if (!client) continue;
      if (!client.last_contacted_date || bestDate > client.last_contacted_date) {
        await base44.asServiceRole.entities.Client.update(clientId, { last_contacted_date: bestDate });
        console.log(`Updated Client ${client.name} last_contacted_date -> ${bestDate}`);
        updated++;
      }
    }

    return Response.json({ message: 'Sync complete', updated });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});