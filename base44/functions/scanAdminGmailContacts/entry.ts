import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { ImapFlow } from 'npm:imapflow@1.0.169';

async function scanViaImap(accountEmail, password, emailMap, updates) {
  const imapClient = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: accountEmail, pass: password },
    logger: false,
  });

  await imapClient.connect();
  const lock = await imapClient.getMailboxLock('INBOX');

  try {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    for await (const message of imapClient.fetch({ since }, { envelope: true })) {
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

  await imapClient.logout();
}

async function scanViaGmailApi(accessToken, emailMap, updates) {
  // Fetch last 90 days of email
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const afterStr = `${since.getFullYear()}/${since.getMonth() + 1}/${since.getDate()}`;

  const query = encodeURIComponent(`after:${afterStr}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  if (!listData.messages) return;

  for (const { id } of listData.messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await msgRes.json();
    const headers = msg.payload?.headers || [];
    const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const rawDate = get('Date');
    if (!rawDate) continue;
    const msgDate = new Date(rawDate).toISOString().split('T')[0];

    const allAddresses = [get('From'), get('To'), get('Cc')]
      .join(',')
      .split(/[,;]/)
      .map(s => {
        const match = s.match(/<([^>]+)>/);
        return (match ? match[1] : s).trim().toLowerCase();
      })
      .filter(Boolean);

    for (const addr of allAddresses) {
      const matchedClient = emailMap[addr];
      if (!matchedClient) continue;
      const existing = updates[matchedClient.id];
      if (!existing || msgDate > existing.date) {
        updates[matchedClient.id] = { date: msgDate, client: matchedClient };
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const clients = await base44.asServiceRole.entities.Client.list();

    // Build email -> client map
    const emailMap = {};
    for (const c of clients) {
      if (c.email) emailMap[c.email.toLowerCase()] = c;
      for (const contact of c.related_contacts || []) {
        if (contact.email) emailMap[contact.email.toLowerCase()] = c;
      }
    }

    const updates = {};

    // 1. Scan william@skillfulmeans.life via Gmail OAuth connector
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      await scanViaGmailApi(accessToken, emailMap, updates);
    } catch (err) {
      console.error(`Gmail connector scan error: ${err.message}`);
    }

    // 2. Scan admin@skillfulmeans.life via IMAP
    const adminEmail = Deno.env.get('GMAIL_ADDRESS') || 'admin@skillfulmeans.life';
    const adminPassword = Deno.env.get('GMAIL_ADMIN_PASSWORD');
    if (adminPassword) {
      try {
        await scanViaImap(adminEmail, adminPassword, emailMap, updates);
      } catch (err) {
        console.error(`IMAP scan error for ${adminEmail}: ${err.message}`);
      }
    }

    // Update clients where email date is newer than stored last_contacted_date
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