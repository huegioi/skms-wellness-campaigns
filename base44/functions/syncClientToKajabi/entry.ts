import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * CLIENT → KAJABI CONTACT SYNC (one-way, app → Kajabi)
 *
 * Every person on a Client record becomes a Kajabi contact:
 *   - the primary email, email2, every related_contacts[].email,
 *   - brokers[].email, broker_email, wellness_consultant_email
 * New Kajabi contacts are created SUBSCRIBED (William's decision 2026-11-04).
 * Existing Kajabi contacts are never re-subscribed: an unsubscribe in Kajabi stands.
 *
 * Tags (existing Kajabi tags, resolved by name):
 *   HR / other / primary contacts → "Client"  (or "Client Lead" while the client is pre-sale)
 *   broker contacts               → "Broker"
 *   wellness_consultant contacts  → "Engagement Consultant"
 * When a Client Lead converts, "Client Lead" is removed and "Client" added. Nothing else is ever removed.
 *
 * Never synced: demo/internal clients, @skillfulmeans.life and team addresses,
 * addresses in EmailSuppression, malformed addresses.
 *
 * Loop guard: the record stores kajabi_sync_signature (emails + tags). If nothing relevant
 * changed, the run exits without touching Kajabi, so our own write-back can't loop.
 *
 * Modes:
 *   entity trigger (payload.event)              → sync that one client
 *   { client_id }                               → sync one client (team member)
 *   { mode: 'backfill', dry_run?: boolean }     → every client still out of sync, ~4 min budget;
 *                                                 rerun until remaining = 0
 */

const KAJABI_API_URL = 'https://api.kajabi.com/v1';
const TAG_CLIENT = 'Client';
const TAG_CLIENT_LEAD = 'Client Lead';
const TAG_BROKER = 'Broker';
const TAG_CONSULTANT = 'Engagement Consultant';
const PRE_SALE_STAGES = new Set([
  'discovery_call_scheduled', 'discovery_call_complete', 'proposal_sent',
  'proposal_viewed', 'negotiation', 'verbal_yes',
]);
const INTERNAL_DOMAINS = ['skillfulmeans.life'];
// William's own test inboxes used when trying out intake forms.
const TEST_ADDRESS = /^(williamcharlesjackson(\+[^@]*)?|huegioi[^@]*)@gmail\.com$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BACKFILL_BUDGET_MS = 240_000;

const TEAM_EMAILS = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || '').toLowerCase()));

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase();

// ── Who is on this client? ────────────────────────────────────────────────────

/** Same rule as shared/clientContact.ts: a string that is really the organization is not a person. */
const ORG_TAIL = /(?:^|[\s,.])(inc|llc|l\.l\.c|llp|lllp|ltd|plc|corp|corporation|co|company|group|holdings?|partners|associates|institute|academy|university|college|district|hospital|clinic|health|healthcare|systems?|foundation|association|society|council|coalition|services|solutions|consulting|consultants|technologies|industries|international|enterprises?|capital|ventures|advisors|advisers|management)\.?$/i;
function personName(name, company) {
  const n = norm(name);
  if (!n) return null;
  if (company && key(n) === key(company)) return null;
  if (ORG_TAIL.test(n)) return null;
  return n;
}

function isPreSale(client) {
  return client.is_assessment_lead === true || PRE_SALE_STAGES.has(client.client_stage);
}

/** Every syncable person on the record, deduped by email, with the tag they should carry. */
function collectPeople(client, partnerEmails = new Set()) {
  const out = new Map();
  const clientTag = isPreSale(client) ? TAG_CLIENT_LEAD : TAG_CLIENT;
  const clientDomain = key(client.email_domain) || (key(client.email).split('@')[1] || '');
  const related = Array.isArray(client.related_contacts) ? client.related_contacts : [];
  const tagFor = (type) => type === 'broker' ? TAG_BROKER : type === 'wellness_consultant' ? TAG_CONSULTANT : clientTag;

  const add = (email, name, phone, type, source) => {
    const e = key(email);
    if (!e || out.has(e)) return;
    // A broker sometimes sits on a client record as an ordinary contact. If the address belongs to a
    // referral partner at ANOTHER organization, tag it as a broker, not a client. A partner at the
    // client's own domain is both (dual roles are additive): they keep the client tag here and the
    // partner sync gives them the partner tags.
    const sameOrg = clientDomain && e.endsWith('@' + clientDomain);
    const role = partnerEmails.has(e) && !sameOrg && type !== 'wellness_consultant' ? 'broker' : type;
    out.set(e, { email: e, name: personName(name, client.company), phone: norm(phone), tag: tagFor(role), source });
  };

  // Related contacts first: they carry the most accurate name + role for their own address.
  for (const r of related) add(r?.email, r?.name, r?.phone, r?.contact_type || 'other', 'related_contact');
  // Top-level fields. Only pair client.name with client.email (never with email2).
  add(client.email, client.name, client.phone, 'other', 'primary');
  add(client.email2, null, null, 'other', 'email2');
  // Brokers and consultants listed on the record.
  for (const b of (Array.isArray(client.brokers) ? client.brokers : [])) add(b?.email, b?.name, b?.phone, 'broker', 'brokers');
  add(client.broker_email, client.broker_name, null, 'broker', 'broker_email');
  add(client.wellness_consultant_email, client.wellness_consultant_name, null, 'wellness_consultant', 'wellness_consultant');
  return [...out.values()];
}

function skipReason(email, suppressed) {
  if (!EMAIL_RE.test(email)) return 'invalid_email';
  if (INTERNAL_DOMAINS.some(d => email.endsWith('@' + d))) return 'internal_address';
  if (TEAM_EMAILS.includes(email)) return 'team_address';
  if (TEST_ADDRESS.test(email)) return 'test_address';
  if (suppressed.has(email)) return 'suppressed';
  return null;
}

function signatureOf(people) {
  return people.map(p => `${p.email}|${p.tag}`).sort().join(';');
}

// ── Kajabi API ────────────────────────────────────────────────────────────────

let _token = null;
async function getToken() {
  if (_token) return _token;
  const clientId = Deno.env.get('KAJABI_CLIENT_ID');
  const clientSecret = Deno.env.get('KAJABI_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('KAJABI_CLIENT_ID or KAJABI_CLIENT_SECRET is not set');
  const res = await fetch(`${KAJABI_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Kajabi auth failed (${res.status}): ${await res.text()}`);
  _token = (await res.json()).access_token;
  return _token;
}

async function kj(path, init = {}) {
  const token = await getToken();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${KAJABI_API_URL}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1500 * (attempt + 1);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error(`Kajabi rate limit: gave up on ${path}`);
}

const _tagIds = new Map();
async function tagId(siteId, name, create) {
  if (_tagIds.has(name)) return _tagIds.get(name);
  let page = 1;
  while (true) {
    const res = await kj(`/contact_tags?filter[site_id]=${siteId}&page[size]=100&page[number]=${page}`);
    if (!res.ok) throw new Error(`Failed to list Kajabi tags (${res.status}): ${await res.text()}`);
    const body = await res.json();
    for (const t of body.data || []) {
      const n = norm(t.attributes?.name);
      if (!_tagIds.has(n)) _tagIds.set(n, String(t.id));
    }
    if (_tagIds.has(name) || !body.links?.next || !(body.data || []).length) break;
    page++;
  }
  if (_tagIds.has(name)) return _tagIds.get(name);
  if (!create) return null;
  const res = await kj('/contact_tags', {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'contact_tags', attributes: { name }, relationships: { site: { data: { type: 'sites', id: String(siteId) } } } } }),
  });
  if (!res.ok) throw new Error(`Kajabi tag "${name}" is missing and could not be created (${res.status}). Create it in Kajabi → Contacts → Tags.`);
  const id = String((await res.json()).data?.id);
  _tagIds.set(name, id);
  console.log(`Created Kajabi tag "${name}" id=${id}`);
  return id;
}

async function findByEmail(siteId, email) {
  // NOTE: Kajabi has no filter[email]. An unknown filter is silently ignored and the API returns the
  // newest contacts, so a filter[email] lookup only "finds" recently created people. email_contains is
  // the real filter; the exact match below narrows it.
  const res = await kj(`/contacts?filter[site_id]=${siteId}&filter[email_contains]=${encodeURIComponent(email)}&page[size]=50`);
  if (!res.ok) throw new Error(`Kajabi contact lookup failed for ${email} (${res.status}): ${await res.text()}`);
  const body = await res.json();
  return (body.data || []).find(c => key(c.attributes?.email) === email) || null;
}

/** Direct lookup by a Kajabi id we stored earlier. Null if it was deleted/merged in Kajabi. */
async function getById(id) {
  const res = await kj(`/contacts/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Kajabi contact ${id} lookup failed (${res.status}): ${await res.text()}`);
  return (await res.json()).data || null;
}

async function createContact(siteId, person) {
  const attributes = { email: person.email, subscribed: true };
  if (person.name) attributes.name = person.name;
  if (person.phone) attributes.phone_number = person.phone;
  const res = await kj('/contacts', {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'contacts', attributes, relationships: { site: { data: { type: 'sites', id: String(siteId) } } } } }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 422 && text.includes('taken')) {
      // Race or case mismatch: someone created it between our lookup and create.
      const again = await findByEmail(siteId, person.email);
      if (again) return { contact: again, created: false };
    }
    throw new Error(`Kajabi create failed for ${person.email} (${res.status}): ${text}`);
  }
  return { contact: (await res.json()).data, created: true };
}

async function contactTagIds(contactId) {
  const res = await kj(`/contacts/${contactId}/relationships/tags`);
  if (!res.ok) return [];
  return ((await res.json()).data || []).map(t => String(t.id));
}

async function setTag(contactId, id, add) {
  const res = await kj(`/contacts/${contactId}/relationships/tags`, {
    method: add ? 'POST' : 'DELETE',
    body: JSON.stringify({ data: [{ type: 'contact_tags', id: String(id) }] }),
  });
  if (!res.ok && !(res.status === 404 && !add)) {
    throw new Error(`Kajabi tag ${add ? 'add' : 'remove'} failed on contact ${contactId} (${res.status}): ${await res.text()}`);
  }
}

// ── One client ────────────────────────────────────────────────────────────────

async function loadSuppressed(base44) {
  try {
    const rows = await base44.asServiceRole.entities.EmailSuppression.list('-created_date', 5000);
    return new Set(rows.map(r => key(r.email)).filter(Boolean));
  } catch (_) {
    return new Set();
  }
}

/**
 * Sync one client. Returns a report. With dryRun, reads Kajabi but writes nothing anywhere.
 * `force` ignores the signature (used when a stored id might be stale).
 */
/** Everyone we know as a broker/partner: ReferralPartner rows plus broker-type rows in the legacy (read-only) Lead table. */
async function loadPartnerEmails(base44) {
  const out = new Set();
  try {
    const rows = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 5000);
    for (const r of rows) if (r.email) out.add(key(r.email));
  } catch (_) { /* best effort */ }
  try {
    const rows = await base44.asServiceRole.entities.Lead.list('-created_date', 5000);
    for (const r of rows) if (r.email && (r.lead_type === 'broker' || r.lead_type === 'broker_lead')) out.add(key(r.email));
  } catch (_) { /* best effort */ }
  return out;
}

async function syncClient(base44, siteId, client, suppressed, partnerEmails, { dryRun = false, force = false } = {}) {
  const report = { client_id: client.id, company: client.company || client.name, people: [], skipped: [] };

  if (client.is_demo) return { ...report, status: 'skipped', reason: 'demo_record' };
  if (client.is_internal) return { ...report, status: 'skipped', reason: 'internal_client' };

  const all = collectPeople(client, partnerEmails);
  const people = [];
  for (const p of all) {
    const why = skipReason(p.email, suppressed);
    if (why) report.skipped.push({ email: p.email, reason: why });
    else people.push(p);
  }
  if (!people.length) return { ...report, status: 'skipped', reason: 'no_syncable_email' };

  const signature = signatureOf(people);
  if (!force && client.kajabi_sync_signature === signature) {
    return { ...report, status: 'unchanged' };
  }

  const ids = { ...(client.kajabi_contact_ids || {}) };
  const errors = [];

  for (const p of people) {
    const row = { email: p.email, name: p.name, tag: p.tag, source: p.source };
    try {
      // Stored id first: Kajabi's search index lags a few seconds behind a create.
      let contact = ids[p.email] ? await getById(ids[p.email]) : null;
      if (contact && key(contact.attributes?.email) !== p.email) contact = null;
      if (!contact) contact = await findByEmail(siteId, p.email);
      if (contact) {
        row.action = 'exists';
      } else if (dryRun) {
        row.action = 'would_create';
        report.people.push(row);
        continue;
      } else {
        const r = await createContact(siteId, p);
        contact = r.contact;
        row.action = r.created ? 'created' : 'exists';
      }
      row.kajabi_id = String(contact.id);
      row.subscribed = contact.attributes?.subscribed;
      ids[p.email] = String(contact.id);

      // Tags
      const want = await tagId(siteId, p.tag, !dryRun);
      const current = await contactTagIds(contact.id);
      if (want && !current.includes(want)) {
        row.tag_action = dryRun ? 'would_add' : 'added';
        if (!dryRun) await setTag(contact.id, want, true);
      } else {
        row.tag_action = want ? 'present' : 'would_create_tag_and_add';
      }
      // Converted client: drop the lead tag.
      if (p.tag === TAG_CLIENT) {
        const leadTag = await tagId(siteId, TAG_CLIENT_LEAD, false);
        if (leadTag && current.includes(leadTag)) {
          row.lead_tag = dryRun ? 'would_remove' : 'removed';
          if (!dryRun) await setTag(contact.id, leadTag, false);
        }
      }
    } catch (err) {
      row.action = 'error';
      row.error = err.message;
      errors.push(err.message);
    }
    report.people.push(row);
  }

  if (!dryRun) {
    const primaryEmail = key(client.email);
    const update = {
      kajabi_contact_ids: ids,
      kajabi_contact_id: ids[primaryEmail] || Object.values(ids)[0] || null,
      kajabi_synced_at: new Date().toISOString(),
    };
    // Only lock in the signature when every person landed, so a failure retries on the next edit/backfill.
    if (!errors.length) update.kajabi_sync_signature = signature;
    await base44.asServiceRole.entities.Client.update(client.id, update);
  }

  return { ...report, status: errors.length ? 'partial' : (dryRun ? 'dry_run' : 'synced'), errors };
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // Entity triggers and scheduled workflow runs carry no user. Anything else must be a team member.
    const isAutomation = !!payload.event || !!payload.automation;
    let user = null;
    if (!isAutomation) {
      user = await base44.auth.me().catch(() => null);
      if (!isTeamMember(user)) return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const siteId = Deno.env.get('KAJABI_SITE_ID');
    if (!siteId) return Response.json({ error: 'KAJABI_SITE_ID is not set' }, { status: 500 });

    const suppressed = await loadSuppressed(base44);
    const partnerEmails = await loadPartnerEmails(base44);

    // ── Backfill ──
    if (payload.mode === 'backfill') {
      const dryRun = payload.dry_run !== false;
      const started = Date.now();
      const clients = [];
      for (let skip = 0; ; skip += 500) {
        const batch = await base44.asServiceRole.entities.Client.list('created_date', 500, skip);
        clients.push(...batch);
        if (batch.length < 500) break;
      }

      const totals = { clients: clients.length, processed: 0, unchanged: 0, skipped_clients: 0, synced: 0, partial: 0,
        would_create: 0, created: 0, already_in_kajabi: 0, tags_to_add: 0, skipped_people: 0, errors: 0 };
      const skippedByReason = {};
      const details = [];
      let remaining = 0;

      for (const c of clients) {
        if (Date.now() - started > BACKFILL_BUDGET_MS) { remaining++; continue; }
        const r = await syncClient(base44, siteId, c, suppressed, partnerEmails, { dryRun });
        totals.processed++;
        if (r.status === 'unchanged') { totals.unchanged++; continue; }
        if (r.status === 'skipped') {
          totals.skipped_clients++;
          skippedByReason[r.reason] = (skippedByReason[r.reason] || 0) + 1;
          continue;
        }
        if (r.status === 'synced') totals.synced++;
        if (r.status === 'partial') totals.partial++;
        totals.skipped_people += r.skipped.length;
        for (const s of r.skipped) skippedByReason[`person_${s.reason}`] = (skippedByReason[`person_${s.reason}`] || 0) + 1;
        for (const p of r.people) {
          if (p.action === 'would_create') totals.would_create++;
          if (p.action === 'created') totals.created++;
          if (p.action === 'exists') totals.already_in_kajabi++;
          if (p.tag_action === 'would_add' || p.tag_action === 'added' || p.tag_action === 'would_create_tag_and_add') totals.tags_to_add++;
          if (p.action === 'error') totals.errors++;
        }
        details.push(r);
      }

      console.log(`Backfill ${dryRun ? 'DRY RUN' : 'LIVE'}: ${JSON.stringify(totals)} skipped=${JSON.stringify(skippedByReason)} remaining=${remaining}`);
      for (const d of details) console.log(`  ${d.status} ${d.company}: ${JSON.stringify(d.people)}${d.skipped.length ? ' skipped=' + JSON.stringify(d.skipped) : ''}`);

      // Names and emails go only to a signed-in team member; automation callers get counts.
      return Response.json({ dry_run: dryRun, totals, skipped_by_reason: skippedByReason, remaining,
        ...(user ? { details } : {}) });
    }

    // ── Single client ──
    const clientId = payload.client_id || payload.event?.entity_id || payload.entity_id || payload.data?.id;
    let client = null;
    if (clientId) client = await base44.asServiceRole.entities.Client.get(clientId).catch(() => null);
    if (!client && payload.data?.id) client = payload.data;
    if (!client) {
      // Deleted between trigger and run, or an unexpected payload shape. Not an error worth failing the
      // workflow over (repeated failures auto-disable it), so log and exit cleanly.
      console.warn(`syncClientToKajabi: no client for id=${clientId || 'none'} payload keys=${Object.keys(payload).join(',')}`);
      return Response.json({ status: 'skipped', reason: 'client_not_found' });
    }

    const result = await syncClient(base44, siteId, client, suppressed, partnerEmails, { dryRun: payload.dry_run === true, force: payload.force === true });
    console.log(`syncClientToKajabi ${result.status} ${result.company}: ${JSON.stringify(result.people)}`);
    return Response.json(user ? result : { status: result.status, people: result.people.length, errors: result.errors?.length || 0 });
  } catch (error) {
    console.error('syncClientToKajabi error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
