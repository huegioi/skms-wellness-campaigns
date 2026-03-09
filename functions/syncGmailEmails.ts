import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { ImapFlow } from 'npm:imapflow@1.0.162';

const ACCOUNTS = [
  { email: 'admin@skillfulmeans.life', passwordEnv: 'GMAIL_ADMIN_PASSWORD' },
  { email: 'shrimi@skillfulmeans.life', passwordEnv: 'GMAIL_SHRIMI_PASSWORD' },
  { email: 'heather@skillfulmeans.life', passwordEnv: 'GMAIL_HEATHER_PASSWORD' },
];

function addrStr(addrs) {
  if (!addrs || addrs.length === 0) return '';
  return addrs.map(a => a.name ? `${a.name} <${a.mailbox}@${a.host}>` : `${a.mailbox}@${a.host}`).join(', ');
}

async function fetchEmailsForAccount(accountEmail, password, clientEmail) {
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

      const recentUids = uids.slice(-10); // last 10 per account

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientEmail } = await req.json();
    if (!clientEmail) return Response.json({ error: 'clientEmail is required' }, { status: 400 });

    const allEmails = [];

    for (const account of ACCOUNTS) {
      const password = Deno.env.get(account.passwordEnv);
      if (!password) continue;
      try {
        const emails = await fetchEmailsForAccount(account.email, password, clientEmail);
        allEmails.push(...emails);
      } catch (err) {
        console.error(`Error fetching from ${account.email}: ${err.message}`);
      }
    }

    allEmails.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    const emails = allEmails.slice(0, 20);
    const lastContactDate = emails[0]?.date || null;

    return Response.json({ emails, lastContactDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});