import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// updateLastContactedFromGmail — "Sync Emails" button on the Partners page.
//
// Scans BOTH William's and Heather's mailboxes and updates last_contacted_date
// on matching Client, Lead, and ReferralPartner records.
//
// William: shared 'gmail' OAuth connector (Gmail API).
// Heather: stored refresh-token exchange (HEATHER_GMAIL_* secrets, gmail.readonly).
//          Read-only — never modifies her mailbox.
//
// Matching: case-insensitive, checks From/To/Cc, matches against email AND email2
// on all three record types (Client, Lead, ReferralPartner) plus Client.related_contacts.
// Uses exact email extraction (regex) — not substring matching.
// ═══════════════════════════════════════════════════════════════════════════

const SKMS_DOMAINS = ['skillfulmeans.life'];

// Extract all email addresses from a header string
function extractEmails(str) {
  if (!str) return [];
  const matches = str.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return matches.map(e => e.toLowerCase());
}

function isSkmsAddress(email) {
  return SKMS_DOMAINS.some(d => email.endsWith('@' + d));
}

// Exchange Heather's stored refresh token for an access token.
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
    if (!res.ok) {
      console.error('[updateLastContactedFromGmail] Heather token exchange failed:', res.status);
      return null;
    }
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[updateLastContactedFromGmail] Heather token exchange error:', e.message);
    return null;
  }
}

// Scan one mailbox and accumulate best contact dates per record.
async function scanMailbox(accessToken, accountLabel, emailMap, bestDates) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // Fetch recent messages (last 500)
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500',
    { headers: authHeader }
  );
  if (!listRes.ok) {
    console.error(`[${accountLabel}] Gmail list failed: ${listRes.status}`);
    return;
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];

  for (const msg of messages) {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date`,
        { headers: authHeader }
      );
      if (!res.ok) continue;
      const message = await res.json();

      const headers = message.payload?.headers || [];
      const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const dateStr = get('Date');
      if (!dateStr) continue;
      const emailDate = new Date(dateStr);
      if (isNaN(emailDate.getTime())) continue;
      const emailDateStr = emailDate.toISOString().split('T')[0];

      // Extract all email addresses from From, To, Cc
      const allAddresses = [
        ...extractEmails(get('From')),
        ...extractEmails(get('To')),
        ...extractEmails(get('Cc')),
      ];

      for (const addr of allAddresses) {
        // Skip SKMS team addresses — we want external contacts
        if (isSkmsAddress(addr)) continue;

        const matched = emailMap[addr];
        if (!matched) continue;

        const key = `${matched.entityType}:${matched.record.id}`;
        if (!bestDates[key] || emailDateStr > bestDates[key].date) {
          bestDates[key] = { date: emailDateStr, entityType: matched.entityType, record: matched.record };
        }
      }
    } catch (e) {
      // Skip individual message errors
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Load all three record types
    const [leads, clients, referralPartners] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ is_archived: { $ne: true } }),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.ReferralPartner.list(),
    ]);

    // Build unified email -> { entityType, record } map (case-insensitive)
    // Priority: Client > Lead > ReferralPartner (first match wins)
    const emailMap = {};

    for (const c of clients) {
      if (c.email) emailMap[c.email.toLowerCase()] = { entityType: 'Client', record: c };
      if (c.email2 && !emailMap[c.email2.toLowerCase()]) {
        emailMap[c.email2.toLowerCase()] = { entityType: 'Client', record: c };
      }
      for (const contact of (c.related_contacts || [])) {
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

    const bestDates = {};

    // 1. Scan William's mailbox via shared Gmail connector
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
      await scanMailbox(accessToken, 'william', emailMap, bestDates);
    } catch (err) {
      console.error(`William scan error: ${err.message}`);
    }

    // 2. Scan Heather's mailbox via OAuth refresh token (read-only)
    const heatherToken = await getHeatherAccessToken();
    if (heatherToken) {
      try {
        await scanMailbox(heatherToken, 'heather', emailMap, bestDates);
      } catch (err) {
        console.error(`Heather scan error: ${err.message}`);
      }
    } else {
      console.warn('Heather Gmail not connected — skipping her mailbox');
    }

    // Apply updates only if the new date is more recent than stored
    let updated = 0;
    for (const { date, entityType, record } of Object.values(bestDates)) {
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
            : null;
          await base44.asServiceRole.entities.Lead.update(record.id, {
            last_contacted_date: date,
            follow_up_due_date: followUpDueDate,
          });
        } else if (entityType === 'ReferralPartner') {
          await base44.asServiceRole.entities.ReferralPartner.update(record.id, { last_contacted_date: date });
        }
        updated++;
      }
    }

    return Response.json({
      message: 'Sync complete',
      updated,
      accounts_scanned: heatherToken ? ['william', 'heather'] : ['william'],
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});