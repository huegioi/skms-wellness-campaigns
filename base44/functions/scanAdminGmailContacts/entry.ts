import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.169';

const SKMS_ACCOUNTS = ['william@skillfulmeans.life', 'heather@skillfulmeans.life', 'admin@skillfulmeans.life'];

function isOutbound(fromEmail, toEmail) {
  const fromLower = (fromEmail || '').toLowerCase();
  return SKMS_ACCOUNTS.some(a => fromLower.includes(a.split('@')[0]));
}

// Parse email address from header string like "Name <email@example.com>" or "email@example.com"
function parseEmail(str) {
  if (!str) return '';
  const match = str.match(/<([^>]+)>/);
  return (match ? match[1] : str).trim().toLowerCase();
}

function parseEmailList(str) {
  if (!str) return [];
  return str.split(/[,;]/).map(s => parseEmail(s)).filter(Boolean);
}

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
      const { from, to, cc, date, messageId } = message.envelope;
      if (!date) continue;

      const msgDate = new Date(date).toISOString().split('T')[0];
      const fromAddr = from?.[0]?.address?.toLowerCase() || '';
      const toAddrs = (to || []).map(a => a.address?.toLowerCase()).filter(Boolean);
      const ccAddrs = (cc || []).map(a => a.address?.toLowerCase()).filter(Boolean);

      const allAddresses = [fromAddr, ...toAddrs, ...ccAddrs];

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
  } finally {
    lock.release();
  }

  await imapClient.logout();
}

async function scanViaGmailApi(accessToken, emailMap, base44, accountLabel) {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const afterStr = `${since.getFullYear()}/${since.getMonth() + 1}/${since.getDate()}`;

  const query = encodeURIComponent(`after:${afterStr}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();

  if (listData.error) {
    if (listData.error.code === 429 || (listData.error.message || '').toLowerCase().includes('quota')) {
      throw new Error('GMAIL_QUOTA: ' + (listData.error.message || 'Rate limit exceeded'));
    }
    throw new Error(listData.error.message || 'Gmail API error');
  }

  if (!listData.messages) return;

  const newLogs = [];
  const updatesFromApi = {};

  // Fetch existing gmail_message_ids from EmailLog to avoid duplicates
  const existingLogs = await base44.asServiceRole.entities.EmailLog.filter({ gmail_account: accountLabel });
  const existingIds = new Set(existingLogs.map(l => l.gmail_message_id));

  for (const { id } of listData.messages) {
    if (existingIds.has(id)) continue;

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await msgRes.json();

    if (msg.error) continue;

    const headers = msg.payload?.headers || [];
    const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const rawDate = get('Date');
    if (!rawDate) continue;
    const msgDate = new Date(rawDate).toISOString().split('T')[0];
    const msgDateTime = new Date(rawDate).toISOString();

    const fromRaw = get('From');
    const toRaw = get('To');
    const ccRaw = get('Cc');
    const subject = get('Subject');
    const snippet = (msg.snippet || '').slice(0, 300);
    const bodyPreview = snippet.slice(0, 500);

    const fromAddr = parseEmail(fromRaw);
    const toAddrs = parseEmailList(toRaw);
    const ccAddrs = parseEmailList(ccRaw);
    const allAddresses = [fromAddr, ...toAddrs, ...ccAddrs];

    const direction = isOutbound(fromRaw, toRaw) ? 'outbound' : 'inbound';

    let matchedClientId = null;
    let matchedLeadId = null;

    for (const addr of allAddresses) {
      const matched = emailMap[addr];
      if (!matched) continue;

      // Update last_contacted tracking
      const key = `${matched.entityType}:${matched.record.id}`;
      const existing = updatesFromApi[key];
      if (!existing || msgDate > existing.date) {
        updatesFromApi[key] = { date: msgDate, entityType: matched.entityType, record: matched.record };
      }

      if (!matchedClientId && matched.entityType === 'Client') matchedClientId = matched.record.id;
      if (!matchedLeadId && matched.entityType === 'Lead') matchedLeadId = matched.record.id;
    }

    if (matchedClientId || matchedLeadId) {
      newLogs.push({
        gmail_message_id: id,
        gmail_account: accountLabel,
        from_email: fromAddr,
        to_email: toAddrs.join(', '),
        cc_emails: ccAddrs.join(', '),
        subject,
        snippet,
        body_preview: bodyPreview,
        date: msgDateTime,
        matched_client_id: matchedClientId || '',
        matched_lead_id: matchedLeadId || '',
        direction,
      });
    }
  }

  // Bulk create new logs
  if (newLogs.length > 0) {
    await base44.asServiceRole.entities.EmailLog.bulkCreate(newLogs);
    console.log(`[scanAdminGmailContacts] Created ${newLogs.length} new EmailLog records for account: ${accountLabel}`);
  }

  return { newLogs: newLogs.length, updates: updatesFromApi };
}

async function scanMailboxViaImap(imapClient, mailboxPath, since, existingIds, emailMap, accountLabel) {
  const updatesFromImap = {};
  const newLogs = [];

  let lock;
  try {
    lock = await imapClient.getMailboxLock(mailboxPath);
  } catch {
    // Mailbox may not exist on this account, skip silently
    return { newLogs, updates: updatesFromImap };
  }

  try {
    for await (const message of imapClient.fetch({ since }, { envelope: true, source: false })) {
      const { from, to, cc, date, messageId } = message.envelope;
      if (!date) continue;

      const uid = String(message.uid);
      const msgId = messageId || uid;

      if (existingIds.has(msgId)) continue;

      const msgDate = new Date(date).toISOString().split('T')[0];
      const msgDateTime = new Date(date).toISOString();

      const fromAddr = from?.[0]?.address?.toLowerCase() || '';
      const toAddrs = (to || []).map(a => a.address?.toLowerCase()).filter(Boolean);
      const ccAddrs = (cc || []).map(a => a.address?.toLowerCase()).filter(Boolean);
      const subject = message.envelope.subject || '';

      const allAddresses = [fromAddr, ...toAddrs, ...ccAddrs];
      const direction = SKMS_ACCOUNTS.some(a => fromAddr.includes(a.split('@')[0])) ? 'outbound' : 'inbound';

      let matchedClientId = null;
      let matchedLeadId = null;

      for (const addr of allAddresses) {
        const matched = emailMap[addr];
        if (!matched) continue;

        const key = `${matched.entityType}:${matched.record.id}`;
        const existing = updatesFromImap[key];
        if (!existing || msgDate > existing.date) {
          updatesFromImap[key] = { date: msgDate, entityType: matched.entityType, record: matched.record };
        }

        if (!matchedClientId && matched.entityType === 'Client') matchedClientId = matched.record.id;
        if (!matchedLeadId && matched.entityType === 'Lead') matchedLeadId = matched.record.id;
      }

      if (matchedClientId || matchedLeadId) {
        newLogs.push({
          gmail_message_id: msgId,
          gmail_account: accountLabel,
          from_email: fromAddr,
          to_email: toAddrs.join(', '),
          cc_emails: ccAddrs.join(', '),
          subject,
          snippet: '',
          body_preview: '',
          date: msgDateTime,
          matched_client_id: matchedClientId || '',
          matched_lead_id: matchedLeadId || '',
          direction,
        });
      }
    }
  } finally {
    lock.release();
  }

  return { newLogs, updates: updatesFromImap };
}

async function scanViaImapAndLog(accountEmail, password, accountLabel, emailMap, base44) {
  const imapClient = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: accountEmail, pass: password },
    logger: false,
  });

  await imapClient.connect();

  const since = new Date();
  since.setDate(since.getDate() - 90);

  // Get existing IDs for this account once, reuse across mailboxes
  const existingLogs = await base44.asServiceRole.entities.EmailLog.filter({ gmail_account: accountLabel });
  const existingIds = new Set(existingLogs.map(l => l.gmail_message_id));

  const allNewLogs = [];
  const allUpdates = {};

  // Scan both INBOX and Sent Mail to catch both inbound and outbound emails
  for (const mailbox of ['INBOX', '[Gmail]/Sent Mail']) {
    try {
      const { newLogs, updates } = await scanMailboxViaImap(imapClient, mailbox, since, existingIds, emailMap, accountLabel);
      for (const log of newLogs) {
        if (!existingIds.has(log.gmail_message_id)) {
          allNewLogs.push(log);
          existingIds.add(log.gmail_message_id); // prevent cross-mailbox duplicates
        }
      }
      for (const [key, val] of Object.entries(updates)) {
        if (!allUpdates[key] || val.date > allUpdates[key].date) {
          allUpdates[key] = val;
        }
      }
    } catch (err) {
      console.error(`Error scanning mailbox ${mailbox} for ${accountLabel}: ${err.message}`);
    }
  }

  await imapClient.logout();

  if (allNewLogs.length > 0) {
    await base44.asServiceRole.entities.EmailLog.bulkCreate(allNewLogs);
    console.log(`[scanAdminGmailContacts] Created ${allNewLogs.length} new EmailLog records for account: ${accountLabel}`);
  }

  return { newLogs: allNewLogs.length, updates: allUpdates };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated admin calls and service-role scheduled calls
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    } catch {
      // No user session — assume scheduled/service call
      isScheduled = true;
    }

    const [clients, leads] = await Promise.all([
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }),
    ]);

    // Build unified email -> { entityType, record } map
    const emailMap = {};

    for (const c of clients) {
      if (c.email) emailMap[c.email.toLowerCase()] = { entityType: 'Client', record: c };
      for (const contact of c.related_contacts || []) {
        if (contact.email) emailMap[contact.email.toLowerCase()] = { entityType: 'Client', record: c };
      }
    }

    for (const lead of leads) {
      if (lead.email && !emailMap[lead.email.toLowerCase()]) {
        emailMap[lead.email.toLowerCase()] = { entityType: 'Lead', record: lead };
      }
      if (lead.email2 && !emailMap[lead.email2.toLowerCase()]) {
        emailMap[lead.email2.toLowerCase()] = { entityType: 'Lead', record: lead };
      }
    }

    const allUpdates = {};
    let totalNewLogs = 0;

    const mergeUpdates = (src) => {
      for (const [key, val] of Object.entries(src || {})) {
        const existing = allUpdates[key];
        if (!existing || val.date > existing.date) {
          allUpdates[key] = val;
        }
      }
    };

    // 1. Scan william@skillfulmeans.life via Gmail OAuth connector
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      const result = await scanViaGmailApi(accessToken, emailMap, base44, 'william');
      mergeUpdates(result?.updates);
      totalNewLogs += result?.newLogs || 0;
    } catch (err) {
      if (err.message?.startsWith('GMAIL_QUOTA')) {
        console.error('GMAIL QUOTA ERROR:', err.message);
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: 'william@skillfulmeans.life',
          subject: 'Gmail Sync Quota Error',
          body: `<p>The Gmail email sync hit a quota/rate limit error at ${new Date().toISOString()}.</p><p>Error details: ${err.message}</p><p>The sync will retry automatically on the next scheduled run.</p>`,
          from_name: 'SKMS System Alert',
        });
      } else {
        console.error(`Gmail connector scan error: ${err.message}`);
      }
    }

    // 2. Scan admin@skillfulmeans.life via IMAP
    const adminEmail = Deno.env.get('GMAIL_ADDRESS') || 'admin@skillfulmeans.life';
    const adminPassword = Deno.env.get('GMAIL_ADMIN_PASSWORD');
    if (adminPassword) {
      try {
        const result = await scanViaImapAndLog(adminEmail, adminPassword, 'admin', emailMap, base44);
        mergeUpdates(result?.updates);
        totalNewLogs += result?.newLogs || 0;
      } catch (err) {
        console.error(`IMAP scan error for ${adminEmail}: ${err.message}`);
      }
    }

    // 3. Scan Heather's account via IMAP
    const heatherEmail = Deno.env.get('GMAIL_HEATHER_ADDRESS');
    const heatherPassword = Deno.env.get('GMAIL_HEATHER_PASSWORD');
    if (heatherEmail && heatherPassword) {
      try {
        const result = await scanViaImapAndLog(heatherEmail, heatherPassword, 'heather', emailMap, base44);
        mergeUpdates(result?.updates);
        totalNewLogs += result?.newLogs || 0;
      } catch (err) {
        console.error(`IMAP scan error for ${heatherEmail}: ${err.message}`);
      }
    }

    // Persist last_contacted_date updates to Client and Lead entities
    let updatedCount = 0;
    for (const { date, entityType, record } of Object.values(allUpdates)) {
      if (!record.last_contacted_date || date > record.last_contacted_date) {
        if (entityType === 'Client') {
          await base44.asServiceRole.entities.Client.update(record.id, { last_contacted_date: date });
        } else if (entityType === 'Lead') {
          await base44.asServiceRole.entities.Lead.update(record.id, { last_contacted_date: date });
        }
        updatedCount++;
      }
    }

    console.log(`[scanAdminGmailContacts] Complete — ${totalNewLogs} new emails logged, ${updatedCount} last_contacted_date updated`);
    return Response.json({ success: true, new_emails_logged: totalNewLogs, contacts_updated: updatedCount });
  } catch (error) {
    console.error('scanAdminGmailContacts error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});