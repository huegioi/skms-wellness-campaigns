import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { shouldExcludeDemo, demoExclusion } from '../../shared/demoPortal.ts';

/**
 * Returns a client's FeedbackResponse + CohortAssessment rows for portal rendering.
 *
 * Accepts, in priority order:
 *   1. client_token            — client portal path (token must match client_id)
 *   2. portal_id + client_id   — broker path (partner must own the client)
 *   3. portal_id + client_ids  — broker bulk path (partner must own EVERY client)
 *   4. admin auth              — authenticated admin caller (client_id only, no token/portal_id)
 *
 * Validation mirrors validateClientReportAccess. All entity reads use the service role
 * (bypassing RLS) so the caller never needs read permission on the entities themselves.
 *
 * Returned rows are projected to portal-rendered fields only.
 */

// Full projections — authenticated admin path only (keeps PII + item-level data).
const FULL_FEEDBACK_FIELDS = [
  'id', 'client_id', 'service_id', 'service_name', 'service_category', 'event_id',
  'event_label', 'attendee_name', 'attendee_email', 'company_name',
  'email_address', 'submitted_at', 'presenter', 'delivery_format',
  'behavior_intent', 'fit_confidence', 'expected_impact',
  'overall_rating', 'nps_score', 'is_demo'
];

const FULL_COHORT_FIELDS = [
  'id', 'client_id', 'service_id', 'proposal_id', 'event_id',
  'participant_email', 'survey_type', 'instrument',
  'instrument_total', 'instrument_subscores', 'item_responses',
  'who5_cheerful', 'who5_calm', 'who5_active', 'who5_rested',
  'who5_interested', 'who5_total', 'cohort_year', 'submitted_at',
  'assessment_phase', 'is_demo'
];

// Portal projections — client_token / portal_id paths. No attendee PII, no
// item-level responses; participant_email is replaced with a salted SHA-256
// pseudonym (see pseudonymizeEmail) so matchPairs grouping still works.
const PORTAL_FEEDBACK_FIELDS = [
  'id', 'client_id', 'service_id', 'service_name', 'service_category', 'event_id',
  'event_label', 'company_name',
  // overall_rating is an aggregate 1–5 session score with no PII — safe for the
  // portal, and needed for the pulse rollup's average-rating tile.
  'submitted_at', 'presenter', 'delivery_format',
  'behavior_intent', 'fit_confidence', 'expected_impact',
  'overall_rating', 'nps_score', 'is_demo'
];

const PORTAL_COHORT_FIELDS = [
  'id', 'client_id', 'service_id', 'proposal_id', 'event_id',
  'participant_email', 'survey_type', 'instrument',
  'instrument_total', 'who5_total', 'cohort_year', 'submitted_at',
  'assessment_phase', 'is_demo'
];

const PORTAL_HASH_SALT = Deno.env.get('PORTAL_HASH_SALT') || Deno.env.get('BASE44_APP_ID') || 'portal-pid-salt-v1';

// pid = first 12 hex chars of SHA-256(lowercased email + server-side salt).
// Deterministic + stable across calls/paths so cross-row pairing by
// participant_email (matchPairs tests equality only) keeps working.
async function pseudonymizeEmail(email) {
  if (!email) return '';
  const normalized = String(email).toLowerCase().trim();
  if (!normalized) return '';
  const data = new TextEncoder().encode(normalized + PORTAL_HASH_SALT);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 12);
}

// Replace the email field on each row with its pseudonym (in place).
// Cached so repeat emails within one response are hashed once.
async function pseudonymizeField(rows, field, cache) {
  for (const r of rows) {
    const raw = r[field];
    if (!raw) continue;
    const key = String(raw).toLowerCase().trim();
    if (!key) continue;
    let pid = cache.get(key);
    if (!pid) { pid = await pseudonymizeEmail(raw); cache.set(key, pid); }
    r[field] = pid;
  }
  return rows;
}

function projectRow(row, fields) {
  const out = {};
  for (const f of fields) {
    if (row[f] !== undefined) out[f] = row[f];
  }
  return out;
}

/**
 * Fetches check-in rows for the given client IDs' CalendarEvents.
 * Excludes demo events and demo check-ins.
 * When stripPii is true (portal/broker paths), projects to
 *   { id, event_id, client_id, checked_in_at }  — no name, no email.
 * When false (admin path), keeps email for the people-engaged count.
 */
async function fetchCheckinsForClients(base44, clientIds, stripPii = false, demoClientIds = new Set()) {
  if (!clientIds || clientIds.length === 0) return [];
  // Fetch events for all clients (no is_demo filter at DB level — partition in
  // memory so demo clients' demo events flow through while real clients' don't).
  const events = await base44.asServiceRole.entities.CalendarEvent.filter(
    { client_id: { $in: clientIds } },
    '-start_date',
    1000
  );
  const keptEvents = events.filter(e => !e.is_demo || demoClientIds.has(e.client_id));
  const eventIds = keptEvents.map(e => e.id);
  if (eventIds.length === 0) return [];
  const checkins = await base44.asServiceRole.entities.EventCheckin.filter(
    { event_id: { $in: eventIds } },
    '-checked_in_at',
    2000
  );
  const keptCheckins = checkins.filter(c => !c.is_demo || demoClientIds.has(c.client_id));
  if (stripPii) {
    return keptCheckins.map(c => ({
      id: c.id,
      event_id: c.event_id,
      client_id: c.client_id,
      checked_in_at: c.checked_in_at,
    }));
  }
  return keptCheckins.map(c => ({
    event_id: c.event_id,
    email: c.email,
    checked_in_at: c.checked_in_at,
  }));
}



/**
 * Program participation — the source for the portal's "Program Participation"
 * chart and the People Engaged hero number.
 *
 * One entry per PROGRAM that has actually happened (past, non-meeting
 * CalendarEvent), listing the DISTINCT people who took part in it: anyone who
 * checked in, left session feedback, or completed an assessment tied to that
 * event. Assessment/feedback rows with no event_id are grouped into a
 * per-service-per-month program bucket so challenges/cohorts still count.
 *
 * - Counts people, not records (one person's 5-instrument assessment = 1).
 * - Dated by the PROGRAM's date, not when a form was submitted.
 * - SkillfulMeans staff (test check-ins) are excluded.
 * - People are returned as salted pseudonyms only — never emails.
 */
const INTERNAL_DOMAINS = ['skillfulmeans.life'];
const isInternalEmail = (e) => INTERNAL_DOMAINS.some(d => e.endsWith('@' + d));
const normEmail = (e) => String(e || '').toLowerCase().trim();
// Drop SkillfulMeans staff test submissions from client-facing report data
// (e.g. a team member test-driving an assessment link before a session).
const notStaff = (email) => { const em = normEmail(email); return !em || !isInternalEmail(em); };
const dropStaffFeedback = (rows) => rows.filter(r => notStaff(r.attendee_email) && notStaff(r.email_address));
const dropStaffCohort = (rows) => rows.filter(r => notStaff(r.participant_email));

async function buildParticipation(base44, clientIds, demoClientIds, feedbackRaw, cohortRaw) {
  if (!clientIds || clientIds.length === 0) return [];
  const events = await base44.asServiceRole.entities.CalendarEvent.filter(
    { client_id: { $in: clientIds } }, '-start_date', 1000
  );
  const now = Date.now();
  const programEvents = events.filter(e =>
    (!e.is_demo || demoClientIds.has(e.client_id)) &&
    e.event_type !== 'meeting' &&
    e.start_date && new Date(e.start_date).getTime() <= now
  );
  const eventIds = programEvents.map(e => e.id);
  const checkins = eventIds.length
    ? await base44.asServiceRole.entities.EventCheckin.filter({ event_id: { $in: eventIds } }, '-checked_in_at', 5000)
    : [];

  const programs = new Map(); // key -> { key, event_id, title, service_id, date, emails:Set }
  for (const e of programEvents) {
    programs.set(e.id, {
      key: e.id,
      event_id: e.id,
      client_id: e.client_id || null,
      title: String(e.title || '').split(' — ')[0].trim() || 'Program',
      service_id: e.service_id || null,
      date: e.start_date,
      emails: new Set(),
    });
  }
  const add = (eventId, email) => {
    const em = normEmail(email);
    if (!em || isInternalEmail(em)) return;
    const p = programs.get(eventId);
    if (p) p.emails.add(em);
  };
  for (const c of checkins) {
    if (c.is_demo && !demoClientIds.has(c.client_id)) continue;
    add(c.event_id, c.email);
  }
  const bucket = (row, email, label) => {
    const em = normEmail(email);
    if (!em || isInternalEmail(em)) return;
    if (row.event_id && programs.has(row.event_id)) { programs.get(row.event_id).emails.add(em); return; }
    if (row.event_id) return; // tied to a future/meeting/other event — not a delivered program
    if (!row.submitted_at) return;
    const month = String(row.submitted_at).slice(0, 7);
    const key = `svc:${row.client_id || 'none'}:${row.service_id || 'unknown'}:${month}`;
    if (!programs.has(key)) {
      programs.set(key, { key, event_id: null, client_id: row.client_id || null, title: label || 'Program', service_id: row.service_id || null, date: row.submitted_at, emails: new Set() });
    }
    const p = programs.get(key);
    if (row.submitted_at < p.date) p.date = row.submitted_at;
    p.emails.add(em);
  };
  for (const r of feedbackRaw) bucket(r, r.attendee_email || r.email_address, r.service_name);
  for (const r of cohortRaw) bucket(r, r.participant_email, null);

  const cache = new Map();
  const out = [];
  for (const p of programs.values()) {
    if (p.emails.size === 0) continue; // no recorded participation → not shown
    const people = [];
    for (const em of p.emails) {
      let pid = cache.get(em);
      if (!pid) { pid = await pseudonymizeEmail(em); cache.set(em, pid); }
      people.push(pid);
    }
    out.push({ key: p.key, event_id: p.event_id, client_id: p.client_id, title: p.title, service_id: p.service_id, date: p.date, people });
  }
  out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return out;
}

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { client_token, portal_id, client_id, client_ids } = body;

    // ── Bulk mode: portal_id + client_ids (BrokerFeedbackRollup) ──────────────
    if (portal_id && Array.isArray(client_ids) && client_ids.length > 0) {
      const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
      if (!partners || partners.length === 0) {
        return Response.json({ allowed: false });
      }
      const partner = partners[0];

      // Validate ownership of ALL requested clients in one query
      const partnerClients = await base44.asServiceRole.entities.Client.filter({ referral_partner_id: partner.id });
      const ownedIds = new Set(partnerClients.map(c => c.id));
      const validIds = client_ids.filter(id => ownedIds.has(id));
      if (validIds.length !== client_ids.length) {
        return Response.json({ allowed: false });
      }

      // Per-client demo flag: a demo broker's portfolio includes demo clients'
      // demo rows (so the demo broker portal shows the product). Real clients'
      // demo rows stay excluded.
      const demoClientIds = new Set(partnerClients.filter(c => c.is_demo === true).map(c => c.id));

      // Fetch feedback + cohort data for all owned clients in parallel
      const [feedbackResults, cohortResults] = await Promise.all([
        Promise.all(validIds.map(id => {
          const exclude = !demoClientIds.has(id);
          return base44.asServiceRole.entities.FeedbackResponse.filter(
            { client_id: id, ...demoExclusion(exclude) }, '-submitted_at', 200
          );
        })),
        Promise.all(validIds.map(id => {
          const exclude = !demoClientIds.has(id);
          return base44.asServiceRole.entities.CohortAssessment.filter(
            { client_id: id, ...demoExclusion(exclude), survey_type: { $ne: 'mfs' } }, '-submitted_at', 500
          );
        })),
      ]);

      const feedbackAll = dropStaffFeedback(feedbackResults.flat());
      const cohortAll = dropStaffCohort(cohortResults.flat());
      const feedback = feedbackAll.map(r => projectRow(r, PORTAL_FEEDBACK_FIELDS));
      const cohorts = cohortAll.map(r => projectRow(r, PORTAL_COHORT_FIELDS));
      const pidCache = new Map();
      await pseudonymizeField(cohorts, 'participant_email', pidCache);
      const checkins = await fetchCheckinsForClients(base44, validIds, true, demoClientIds);
      const participation = await buildParticipation(base44, validIds, demoClientIds, feedbackAll, cohortAll);
      return Response.json({ allowed: true, feedback_responses: feedback, cohort_assessments: cohorts, checkins, participation });
    }

    // ── Single-client mode ────────────────────────────────────────────────────
    if (!client_id) {
      return Response.json({ allowed: false, error: 'client_id is required' }, { status: 400 });
    }

    let allowed = false;

    // Priority 1: client_token (must match the client)
    if (!allowed && client_token) {
      const tokenClients = await base44.asServiceRole.entities.Client.filter({ portal_token: client_token });
      if (tokenClients && tokenClients.length > 0 && tokenClients[0].id === client_id) {
        allowed = true;
      }
    }

    // Priority 2: portal_id (broker must own the client)
    if (!allowed && portal_id) {
      const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
      if (partners && partners.length > 0) {
        const partner = partners[0];
        const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id, referral_partner_id: partner.id });
        if (clients && clients.length > 0) {
          allowed = true;
        }
      }
    }

    // Priority 3: authenticated admin
    if (!allowed) {
      try {
        const user = await base44.auth.me();
        if (isTeamMember(user)) {
          allowed = true;
        }
      } catch { /* not authenticated — fall through to denied */ }
    }

    if (!allowed) {
      return Response.json({ allowed: false });
    }

    // Resolve the owning client so a demo client's own portal shows its demo
    // rows (real client → demo rows excluded).
    const ownerClients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const ownerClient = ownerClients[0] || null;
    const excludeDemo = shouldExcludeDemo(ownerClient);
    const demoFrag = demoExclusion(excludeDemo);

    // Fetch feedback + cohort data for this client.
    // MFS rows are fetched SEPARATELY rather than by lifting the $ne filter:
    // one MFS respondent produces 4 rows, so a large team assessment would
    // otherwise crowd the cohort arc out of the shared 500-row limit.
    const [feedbackRaw, cohortsRaw, mfsRows] = await Promise.all([
      base44.asServiceRole.entities.FeedbackResponse.filter({ client_id, ...demoFrag }, '-submitted_at', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ client_id, ...demoFrag, survey_type: { $ne: 'mfs' } }, '-submitted_at', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ client_id, ...demoFrag, survey_type: 'mfs' }, '-submitted_at', 2000),
    ]);

    const feedback = dropStaffFeedback(feedbackRaw);
    const cohorts = dropStaffCohort(cohortsRaw);

    // Portal paths (client_token or portal_id) strip PII + pseudonymize;
    // the authenticated-admin path keeps full fields.
    const isPortalPath = !!(client_token || portal_id);
    const feedbackFields = isPortalPath ? PORTAL_FEEDBACK_FIELDS : FULL_FEEDBACK_FIELDS;
    const cohortFields = isPortalPath ? PORTAL_COHORT_FIELDS : FULL_COHORT_FIELDS;
    const projectedFeedback = feedback.map(r => projectRow(r, feedbackFields));
    const projectedCohorts = cohorts.map(r => projectRow(r, cohortFields));
    // MFS is anonymous by design (participant_email is always empty) and is a
    // single-point team measure, so it never needs pseudonymizing or pairing.
    const projectedMfs = mfsRows.map(r => projectRow(r, cohortFields));
    if (isPortalPath) {
      const pidCache = new Map();
      await pseudonymizeField(projectedCohorts, 'participant_email', pidCache);
    }
    const checkins = await fetchCheckinsForClients(base44, [client_id], isPortalPath, excludeDemo ? new Set() : new Set([client_id]));
    const participation = await buildParticipation(base44, [client_id], excludeDemo ? new Set() : new Set([client_id]), feedback, cohorts);

    return Response.json({
      allowed: true,
      feedback_responses: projectedFeedback,
      cohort_assessments: projectedCohorts,
      mfs_assessments: projectedMfs,
      checkins,
      participation,
    });
  } catch (error) {
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
});