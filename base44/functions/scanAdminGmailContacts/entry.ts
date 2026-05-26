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
        const matched = emailMap[addr];
        if (!matched) continue;
        const key = `${matched.entityType}:${matched.record.id}`;
        const existing = updates[key];
        if (!existing || msgDate > existing.date) {
          updates[key] = { date: msgDate, entityType: matched.entityType, record: matched.record };
        }
      }
    }
  } finally {
    lock.release();
  }

  await imapClient.logout();
}

async function scanViaGmailApi(accessToken, emailMap, updates) {
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
      const matched = emailMap[addr];
      if (!matched) continue;
      const key = `${matched.entityType}:${matched.record.id}`;
      const existing = updates[key];
      if (!existing || msgDate > existing.date) {
        updates[key] = { date: msgDate, entityType: matched.entityType, record: matched.record };
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

    const [clients, referralPartners] = await Promise.all([
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.ReferralPartner.list(),
    ]);

    // Build unified email -> { entityType, record } map
    const emailMap = {};

    for (const c of clients) {
      if (c.email) emailMap[c.email.toLowerCase()] = { entityType: 'Client', record: c };
      for (const contact of c.related_contacts || []) {
        if (contact.email) emailMap[contact.email.toLowerCase()] = { entityType: 'Client', record: c };
      }
    }

    for (const p of referralPartners) {
      if (p.email) {
        // Don't overwrite a Client entry with a ReferralPartner for the same address
        if (!emailMap[p.email.toLowerCase()]) {
          emailMap[p.email.toLowerCase()] = { entityType: 'ReferralPartner', record: p };
        }
      }
    }

    // updates keyed by "EntityType:id"
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

    // 3. Scan Heather's account via IMAP
    const heatherEmail = Deno.env.get('GMAIL_HEATHER_ADDRESS');
    const heatherPassword = Deno.env.get('GMAIL_HEATHER_PASSWORD');
    if (heatherEmail && heatherPassword) {
      try {
        await scanViaImap(heatherEmail, heatherPassword, emailMap, updates);
      } catch (err) {
        console.error(`IMAP scan error for ${heatherEmail}: ${err.message}`);
      }
    }

    // Persist updates to Client and ReferralPartner entities
    let updatedCount = 0;
    for (const { date, entityType, record } of Object.values(updates)) {
      if (!record.last_contacted_date || date > record.last_contacted_date) {
        if (entityType === 'Client') {
          await base44.asServiceRole.entities.Client.update(record.id, { last_contacted_date: date });
        } else if (entityType === 'ReferralPartner') {
          await base44.asServiceRole.entities.ReferralPartner.update(record.id, { last_contacted_date: date });
        }
        updatedCount++;
      }
    }

    return Response.json({ success: true, updated: updatedCount, scanned: Object.keys(emailMap).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});