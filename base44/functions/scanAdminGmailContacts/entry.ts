import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { ImapFlow } from 'npm:imapflow@1.0.169';

const SKMS_ACCOUNTS = ['william@skillfulmeans.life', 'heather@skillfulmeans.life', 'admin@skillfulmeans.life'];

// Exchange Heather's stored refresh token for a Gmail access token (read-only).
// Returns null on any failure — never blocks the William scan.
async function getHeatherAccessToken() {
  const clientId = Deno.env.get('HEATHER_GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('HEATHER_GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('HEATHER_GMAIL_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithQuotaRetry(url, headers) {
  const res = await fetch(url, { headers });
  if (res.status === 429) {
    await sleep(3000);
    return fetch(url, { headers });
  }
  return res;
}

async function scanViaGmailApi(accessToken, emailMap, base44, accountLabel, daysBack = 90) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const afterStr = `${since.getFullYear()}/${since.getMonth() + 1}/${since.getDate()}`;

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // Get existing IDs to avoid duplicate fetches
  const existingLogs = await base44.asServiceRole.entities.EmailLog.filter({ gmail_account: accountLabel });
  const existingIds = new Set(existingLogs.map(l => l.gmail_message_id));

  const updatesFromApi = {};
  let totalNewLogs = 0;

  const contactEmails = Object.keys(emailMap);
  const BATCH_SIZE = 10;

  for (let i = 0; i < contactEmails.length; i += BATCH_SIZE) {
    const batch = contactEmails.slice(i, i + BATCH_SIZE);
    let batchMessageIds = [];

    // --- List phase: collect message IDs for this batch ---
    try {
      const orQuery = batch.map(e => `{from:${e} to:${e}}`).join(' OR ');
      const query = encodeURIComponent(`(${orQuery}) after:${afterStr}`);

      let pageToken = null;
      do {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const listRes = await fetchWithQuotaRetry(url, authHeaders);
        const listData = await listRes.json();

        if (listData.error) {
          const isQuota = listData.error.code === 429 || (listData.error.message || '').toLowerCase().includes('quota');
          console.error(`[scanAdminGmailContacts] List error for batch ${i}-${i + batch.length}: ${listData.error.message}${isQuota ? ' (quota)' : ''}`);
          break;
        }

        if (listData.messages) {
          for (const m of listData.messages) {
            if (!existingIds.has(m.id)) batchMessageIds.push(m.id);
          }
        }
        pageToken = listData.nextPageToken || null;
      } while (pageToken);
    } catch (err) {
      console.error(`[scanAdminGmailContacts] List phase failed for batch ${i}: ${err.message}`);
      await sleep(250);
      continue; // skip to next batch
    }

    // --- Fetch phase: get metadata for each new message ---
    const batchLogs = [];
    for (const id of batchMessageIds) {
      if (existingIds.has(id)) continue;

      try {
        await sleep(250); // small delay between individual message fetches
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date&metadataHeaders=Subject`;
        const msgRes = await fetchWithQuotaRetry(msgUrl, authHeaders);
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

        const fromAddr = parseEmail(fromRaw);
        const toAddrs = parseEmailList(toRaw);
        const ccAddrs = parseEmailList(ccRaw);
        const allAddresses = [fromAddr, ...toAddrs, ...ccAddrs];
        const direction = isOutbound(fromRaw, toRaw) ? 'outbound' : 'inbound';

        let matchedClientId = null;
        let matchedLeadId = null;
        let matchedPartnerId = null;

        for (const addr of allAddresses) {
          const matched = emailMap[addr];
          if (!matched) continue;

          const key = `${matched.entityType}:${matched.record.id}`;
          const existing = updatesFromApi[key];
          if (!existing || msgDate > existing.date) {
            updatesFromApi[key] = { date: msgDate, entityType: matched.entityType, record: matched.record };
          }

          if (!matchedClientId && matched.entityType === 'Client') matchedClientId = matched.record.id;
          if (!matchedLeadId && matched.entityType === 'Lead') matchedLeadId = matched.record.id;
          if (!matchedPartnerId && matched.entityType === 'ReferralPartner') matchedPartnerId = matched.record.id;
        }

        if (matchedClientId || matchedLeadId || matchedPartnerId) {
          batchLogs.push({
            gmail_message_id: id,
            gmail_account: accountLabel,
            from_email: fromAddr,
            to_email: toAddrs.join(', '),
            cc_emails: ccAddrs.join(', '),
            subject,
            snippet,
            body_preview: snippet,
            date: msgDateTime,
            matched_client_id: matchedClientId || '',
            matched_lead_id: matchedLeadId || '',
            matched_referral_partner_id: matchedPartnerId || '',
            direction,
          });
          existingIds.add(id); // prevent re-processing in future batches
        }
      } catch (err) {
        console.error(`[scanAdminGmailContacts] Message fetch failed for ${id}: ${err.message}`);
      }
    }

    // Persist incrementally after each batch
    if (batchLogs.length > 0) {
      await base44.asServiceRole.entities.EmailLog.bulkCreate(batchLogs);
      totalNewLogs += batchLogs.length;
      console.log(`[scanAdminGmailContacts] Batch ${i}-${i + batch.length}: saved ${batchLogs.length} new EmailLog records (${accountLabel})`);
    }

    await sleep(250); // small pause between batches
  }

  return { newLogs: totalNewLogs, updates: updatesFromApi };
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
      let matchedPartnerId = null;

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
        if (!matchedPartnerId && matched.entityType === 'ReferralPartner') matchedPartnerId = matched.record.id;
      }

      if (matchedClientId || matchedLeadId || matchedPartnerId) {
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
          matched_referral_partner_id: matchedPartnerId || '',
          direction,
        });
      }
    }
  } finally {
    lock.release();
  }

  return { newLogs, updates: updatesFromImap };
}

async function scanViaImapAndLog(accountEmail, password, accountLabel, emailMap, base44, daysBack = 90) {
  const imapClient = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: accountEmail, pass: password },
    logger: false,
  });

  await imapClient.connect();

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

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
      if (user && !isTeamMember(user)) {
        return Response.json({ error: 'Team only' }, { status: 403 });
      }
    } catch {
      // No user session — assume scheduled/service call
      isScheduled = true;
    }

    const body = await req.json().catch(() => ({}));
    const daysBack = body.days_back || 90;

    const [clients, leads, referralPartners] = await Promise.all([
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead', is_archived: { $ne: true } }),
      base44.asServiceRole.entities.ReferralPartner.list(),
    ]);

    // Build unified email -> { entityType, record } map
    const emailMap = {};

    for (const c of clients) {
      if (c.email) emailMap[c.email.toLowerCase()] = { entityType: 'Client', record: c };
      if (c.email2 && !emailMap[c.email2.toLowerCase()]) {
        emailMap[c.email2.toLowerCase()] = { entityType: 'Client', record: c };
      }
      for (const contact of c.related_contacts || []) {
        if (contact.email && !emailMap[contact.email.toLowerCase()]) {
          emailMap[contact.email.toLowerCase()] = { entityType: 'Client', record: c };
        }
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

    for (const p of referralPartners) {
      if (p.email && !emailMap[p.email.toLowerCase()]) {
        emailMap[p.email.toLowerCase()] = { entityType: 'ReferralPartner', record: p };
      }
      if (p.email2 && !emailMap[p.email2.toLowerCase()]) {
        emailMap[p.email2.toLowerCase()] = { entityType: 'ReferralPartner', record: p };
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
      const result = await scanViaGmailApi(accessToken, emailMap, base44, 'william', daysBack);
      mergeUpdates(result?.updates);
      totalNewLogs += result?.newLogs || 0;
    } catch (err) {
      console.error(`Gmail connector scan error: ${err.message}`);
      // Send quota alert without stopping the run
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: 'william@skillfulmeans.life',
          subject: 'Gmail Sync Error',
          body: `<p>The Gmail email sync encountered an error at ${new Date().toISOString()}.</p><p>Error details: ${err.message}</p><p>The sync will retry automatically on the next scheduled run.</p>`,
          from_name: 'SkillfulMeans System Alert',
        });
      } catch (mailErr) {
        console.error('Failed to send quota alert email:', mailErr.message);
      }
    }

    // 2. Scan admin@skillfulmeans.life via IMAP
    const adminEmail = Deno.env.get('GMAIL_ADDRESS') || 'admin@skillfulmeans.life';
    const adminPassword = Deno.env.get('GMAIL_ADMIN_PASSWORD');
    if (adminPassword) {
      try {
        const result = await scanViaImapAndLog(adminEmail, adminPassword, 'admin', emailMap, base44, daysBack);
        mergeUpdates(result?.updates);
        totalNewLogs += result?.newLogs || 0;
      } catch (err) {
        console.error(`IMAP scan error for ${adminEmail}: ${err.message}`);
      }
    }

    // 3. Scan Heather's mailbox via OAuth refresh token (read-only Gmail API)
    const heatherToken = await getHeatherAccessToken();
    if (heatherToken) {
      try {
        const result = await scanViaGmailApi(heatherToken, emailMap, base44, 'heather', daysBack);
        mergeUpdates(result?.updates);
        totalNewLogs += result?.newLogs || 0;
      } catch (err) {
        console.error(`Gmail API scan error for heather: ${err.message}`);
      }
    } else {
      console.warn('Heather Gmail not connected — skipping her mailbox');
    }

    // Persist last_contacted_date updates to Client, Lead, and ReferralPartner entities
    let updatedCount = 0;
    for (const { date, entityType, record } of Object.values(allUpdates)) {
      if (!record.last_contacted_date || date > record.last_contacted_date) {
        if (entityType === 'Client') {
          await base44.asServiceRole.entities.Client.update(record.id, { last_contacted_date: date });
        } else if (entityType === 'Lead') {
          // Recompute follow_up_due_date anchored to the new contact date
          const stage = record.follow_up_stage || '';
          const dayMatch = stage.match(/Day\s+(\d+)/i);
          const followUpDueDate = dayMatch
            ? (() => {
                const d = new Date(date);
                d.setDate(d.getDate() + parseInt(dayMatch[1], 10));
                return d.toISOString().split('T')[0];
              })()
            : null; // engagement stages never show overdue
          await base44.asServiceRole.entities.Lead.update(record.id, {
            last_contacted_date: date,
            follow_up_due_date: followUpDueDate,
          });
        } else if (entityType === 'ReferralPartner') {
          await base44.asServiceRole.entities.ReferralPartner.update(record.id, { last_contacted_date: date });
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