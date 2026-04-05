import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { ImapFlow } from 'npm:imapflow@1.0.169';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const adminEmail = Deno.env.get('GMAIL_ADDRESS') || 'admin@skillfulmeans.life';
    const adminPassword = Deno.env.get('GMAIL_ADMIN_PASSWORD');

    if (!adminPassword) {
      return Response.json({ error: 'GMAIL_ADMIN_PASSWORD not set' }, { status: 500 });
    }

    const clients = await base44.asServiceRole.entities.Client.list();

    // Build email -> client map
    const emailMap = {};
    for (const client of clients) {
      if (client.email) emailMap[client.email.toLowerCase()] = client;
      for (const contact of client.related_contacts || []) {
        if (contact.email) emailMap[contact.email.toLowerCase()] = client;
      }
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: adminEmail, pass: adminPassword },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    const updates = {};

    try {
      // Fetch last 100 messages
      const since = new Date();
      since.setDate(since.getDate() - 30);

      for await (const message of client.fetch({ since }, { envelope: true })) {
        const { from, to, cc, date } = message.envelope;
        if (!date) continue;

        const msgDate = new Date(date).toISOString().split('T')[0];
        const addresses = [
          ...(from || []),
          ...(to || []),
          ...(cc || []),
        ].map(a => a.address?.toLowerCase()).filter(Boolean);

        for (const addr of addresses) {
          const matchedClient = emailMap[addr];
          if (!matchedClient) continue;
          const existing = updates[matchedClient.id];
          if (!existing || msgDate > existing.date) {
            updates[matchedClient.id] = { date: msgDate, client: matchedClient };
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    // Update clients
    let updatedCount = 0;
    for (const { date, client: c } of Object.values(updates)) {
      if (!c.last_contacted_date || date > c.last_contacted_date) {
        await base44.asServiceRole.entities.Client.update(c.id, { last_contacted_date: date });
        updatedCount++;
      }
    }

    return Response.json({ success: true, updated: updatedCount, scanned: Object.keys(emailMap).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});