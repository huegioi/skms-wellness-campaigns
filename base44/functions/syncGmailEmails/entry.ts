import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ImapFlow } from 'npm:imapflow@1.0.162';

const IMAP_ACCOUNTS = [
  { email: 'admin@skillfulmeans.life', passwordEnv: 'GMAIL_ADMIN_PASSWORD' },
  { email: 'shrimi@skillfulmeans.life', passwordEnv: 'GMAIL_SHRIMI_PASSWORD' },
  { email: 'heather@skillfulmeans.life', passwordEnv: 'GMAIL_HEATHER_PASSWORD' },
];

function addrStr(addrs) {
  if (!addrs || addrs.length === 0) return '';
  return addrs.map(a => {
    if (a.address) {
      return a.name ? `${a.name} <${a.address}>` : a.address;
    } else if (a.mailbox && a.host) {
      return a.name ? `${a.name} <${a.mailbox}@${a.host}>` : `${a.mailbox}@${a.host}`;
    }
    return null;
  }).filter(Boolean).join(', ');
}

async function fetchViaImap(accountEmail, password, clientEmail) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: accountEmail, pass: password },
    logger: false,
  });

  const emails = [];
  await client.connect();

  try {
    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    try {
      const uids = await client.search(
        { or: [{ from: clientEmail }, { to: clientEmail }] },
        { uid: true }
      );

      if (!uids || uids.length === 0) return emails;

      const recentUids = uids.slice(-10);

      for await (const msg of client.fetch(recentUids, { envelope: true, uid: true }, { uid: true })) {
        const fromStr = addrStr(msg.envelope.from);
        const toStr = addrStr(msg.envelope.to);
        const isFromClient = fromStr.toLowerCase().includes(clientEmail.toLowerCase());

        emails.push({
          id: `${accountEmail}:${msg.uid}`,
          uid: msg.uid,
          account: accountEmail,
          subject: msg.envelope.subject || '(No Subject)',
          from: fromStr,
          to: toStr,
          date: msg.envelope.date ? new Date(msg.envelope.date).toISOString() : null,
          snippet: '',
          direction: isFromClient ? 'received' : 'sent',
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}

async function fetchViaGmailApi(accessToken, clientEmail) {
  const query = encodeURIComponent(`from:${clientEmail} OR to:${clientEmail}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  if (!listData.messages) return [];

  const profileRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/profile`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const profile = await profileRes.json();
  const accountEmail = profile.emailAddress || 'william@skillfulmeans.life';

  const emails = [];
  for (const { id } of listData.messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await msgRes.json();
    const headers = msg.payload?.headers || [];
    const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromVal = get('From');
    const isFromClient = fromVal.toLowerCase().includes(clientEmail.toLowerCase());

    emails.push({
      id: msg.id,
      threadId: msg.threadId,
      account: accountEmail,
      subject: get('Subject') || '(No Subject)',
      from: fromVal,
      to: get('To'),
      date: get('Date') ? new Date(get('Date')).toISOString() : null,
      snippet: msg.snippet || '',
      direction: isFromClient ? 'received' : 'sent',
    });
  }

  return emails;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientEmail } = await req.json();
    if (!clientEmail) return Response.json({ error: 'clientEmail is required' }, { status: 400 });

    const allEmails = [];

    // 1. Fetch via Gmail OAuth connector (william@skillfulmeans.life)
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const emails = await fetchViaGmailApi(accessToken, clientEmail);
      allEmails.push(...emails);
    } catch (err) {
      console.error(`Error fetching via Gmail connector: ${err.message}`);
    }

    // 2. Fetch via IMAP for accounts that have passwords set
    for (const account of IMAP_ACCOUNTS) {
      const password = Deno.env.get(account.passwordEnv);
      if (!password) continue;
      try {
        const emails = await fetchViaImap(account.email, password, clientEmail);
        allEmails.push(...emails);
      } catch (err) {
        console.error(`Error fetching from ${account.email}: ${err.message}`);
      }
    }

    // Sort newest first
    allEmails.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    const emails = allEmails.slice(0, 25);
    const lastContactDate = emails[0]?.date || null;

    // Auto-update last_contacted_date on matching Lead and Client if email date is more recent
    if (lastContactDate) {
      const emailDateStr = new Date(lastContactDate).toISOString().split('T')[0];
      try {
        const leads = await base44.asServiceRole.entities.Lead.filter({ email: clientEmail });
        if (leads.length > 0) {
          const lead = leads[0];
          const existing = lead.last_contacted_date;
          if (!existing || emailDateStr > existing) {
            await base44.asServiceRole.entities.Lead.update(lead.id, { last_contacted_date: emailDateStr });
          }
        }
      } catch (err) {
        console.error(`Failed to update lead last_contacted_date: ${err.message}`);
      }
      try {
        const clients = await base44.asServiceRole.entities.Client.filter({ email: clientEmail });
        if (clients.length > 0) {
          const client = clients[0];
          const existing = client.last_contacted_date;
          if (!existing || emailDateStr > existing) {
            await base44.asServiceRole.entities.Client.update(client.id, {
              last_contacted_date: emailDateStr,
              last_contacted: emailDateStr,
            });
          }
        }
      } catch (err) {
        console.error(`Failed to update client last_contacted_date: ${err.message}`);
      }
    }

    return Response.json({ emails, lastContactDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});