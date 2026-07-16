import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Best-effort automation: scans recent Gmail messages for LinkedIn notification
 * emails (from linkedin.com senders), extracts the sender's person-name from
 * the subject/body, and matches it against Leads/Clients/Partners.
 *
 * - Unique match (>5-char name, exactly one entity): logs an inbound
 *   ClientInteraction (channel=linkedin, subject="LinkedIn reply received").
 * - Ambiguous (multiple matches): added to a review list in the response; no
 *   interaction is auto-logged.
 *
 * Payload: { maxResults?: number (default 50) }
 * Returns: { scanned, matched, logged, ambiguous: [...] }
 */
const LINKEDIN_SENDER_RE = /linkedin\.com/i;
const NAME_MIN_LEN = 5;

// Patterns for LinkedIn email subjects/bodies:
// "John Smith would like to connect", "You have 1 new message from John Smith",
// "John Smith sent you a message on LinkedIn", "John Smith replied to your message"
const SUBJECT_PATTERNS = [
  /(.+?)\s+would like to connect/i,
  /new message from\s+(.+?)(?:\s+on|\s*$)/i,
  /(.+?)\s+sent you a message/i,
  /(.+?)\s+replied to your/i,
  /message from\s+(.+?)(?:\s+on|\s*$)/i,
  /(.+?)\s+invited you to connect/i,
];

function extractName(subject, snippet) {
  const text = `${subject || ''} ${snippet || ''}`;
  for (const re of SUBJECT_PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      const name = m[1].trim().replace(/[""]/g, '');
      if (name.length >= NAME_MIN_LEN) return name;
    }
  }
  return null;
}

function nameMatchesEntity(name, entity) {
  if (!name || !entity?.name) return false;
  const entityName = entity.name.toLowerCase().trim();
  const searchName = name.toLowerCase().trim();
  if (searchName.length < NAME_MIN_LEN) return false;
  // Require the extracted name to contain the entity name or vice-versa
  return entityName.includes(searchName) || searchName.includes(entityName);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const maxResults = body.maxResults || 50;

    // Fetch recent messages via the Gmail connector
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:linkedin.com&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listData.messages) return Response.json({ scanned: 0, matched: 0, logged: 0, ambiguous: [] });

    // Load all entities once for matching
    const [leads, clients, partners] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ is_demo: false }, '-created_date', 500),
      base44.asServiceRole.entities.Client.filter({ is_demo: false }, '-created_date', 500),
      base44.asServiceRole.entities.ReferralPartner.filter({ is_demo: false }, '-created_date', 500),
    ]);

    // Track which Gmail message IDs we've already logged (dedup by subject+date+name)
    const loggedKey = (name, date) => `${name}|${date}`;

    let scanned = 0;
    let matched = 0;
    let logged = 0;
    const ambiguous = [];

    for (const { id } of listData.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const get = (n) => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';

      const fromVal = get('From');
      if (!LINKEDIN_SENDER_RE.test(fromVal)) continue;
      scanned++;

      const subject = get('Subject') || '';
      const snippet = msg.snippet || '';
      const dateStr = get('Date') ? new Date(get('Date')).toISOString() : new Date().toISOString();

      const name = extractName(subject, snippet);
      if (!name) continue;

      // Match against all entity types
      const leadMatches = leads.filter(l => nameMatchesEntity(name, l));
      const clientMatches = clients.filter(c => nameMatchesEntity(name, c));
      const partnerMatches = partners.filter(p => nameMatchesEntity(name, p));

      const totalMatches = leadMatches.length + clientMatches.length + partnerMatches.length;
      if (totalMatches === 0) continue;
      matched++;

      if (totalMatches === 1) {
        // Unique match — log inbound interaction
        let entityType, entityId;
        if (leadMatches.length === 1) { entityType = 'lead'; entityId = leadMatches[0].id; }
        else if (clientMatches.length === 1) { entityType = 'client'; entityId = clientMatches[0].id; }
        else { entityType = 'partner'; entityId = partnerMatches[0].id; }

        // Dedup: skip if an inbound LinkedIn interaction already exists for this entity in the last 24h
        const recentInteractions = await base44.asServiceRole.entities.ClientInteraction.filter(
          { channel: 'linkedin', subject: 'LinkedIn reply received' },
          '-date',
          10
        );
        const dedupKey = loggedKey(name, dateStr.slice(0, 10));
        const alreadyLogged = recentInteractions.some(i => {
          if (entityType === 'lead' && i.lead_id !== entityId) return false;
          if (entityType === 'client' && i.client_id !== entityId) return false;
          if (entityType === 'partner' && i.referral_partner_id !== entityId) return false;
          return i.notes && i.notes.includes(name);
        });
        if (alreadyLogged) continue;

        const interaction = {
          channel: 'linkedin',
          interaction_type: 'note',
          subject: 'LinkedIn reply received',
          notes: `From: ${name}\nSubject: ${subject}`,
          date: dateStr,
        };
        if (entityType === 'lead') interaction.lead_id = entityId;
        else if (entityType === 'client') interaction.client_id = entityId;
        else interaction.referral_partner_id = entityId;

        await base44.asServiceRole.entities.ClientInteraction.create(interaction);
        logged++;
      } else {
        // Ambiguous — add to review list, don't auto-log
        ambiguous.push({
          name,
          subject,
          date: dateStr,
          leadMatches: leadMatches.length,
          clientMatches: clientMatches.length,
          partnerMatches: partnerMatches.length,
        });
      }
    }

    return Response.json({ scanned, matched, logged, ambiguous });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});