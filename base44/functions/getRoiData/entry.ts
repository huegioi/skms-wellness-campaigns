import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

const PORTAL_FEEDBACK_FIELDS = [
  'id', 'client_id', 'service_id', 'service_name', 'service_category', 'event_id',
  'event_label', 'attendee_name', 'attendee_email', 'company_name',
  'email_address', 'submitted_at', 'presenter', 'delivery_format',
  'behavior_intent', 'fit_confidence', 'expected_impact',
  'nps_score', 'is_demo'
];

const PORTAL_COHORT_FIELDS = [
  'id', 'client_id', 'service_id', 'proposal_id', 'event_id',
  'participant_email', 'survey_type', 'instrument',
  'instrument_total', 'instrument_subscores', 'item_responses',
  'who5_cheerful', 'who5_calm', 'who5_active', 'who5_rested',
  'who5_interested', 'who5_total', 'cohort_year', 'submitted_at',
  'assessment_phase', 'is_demo'
];

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
 * Returns projected rows: { event_id, email, checked_in_at }
 */
async function fetchCheckinsForClients(base44, clientIds) {
  if (!clientIds || clientIds.length === 0) return [];
  const events = await base44.asServiceRole.entities.CalendarEvent.filter(
    { client_id: { $in: clientIds }, is_demo: { $ne: true } },
    '-start_date',
    1000
  );
  const eventIds = events.map(e => e.id);
  if (eventIds.length === 0) return [];
  const checkins = await base44.asServiceRole.entities.EventCheckin.filter(
    { event_id: { $in: eventIds }, is_demo: { $ne: true } },
    '-checked_in_at',
    2000
  );
  return checkins.map(c => ({
    event_id: c.event_id,
    email: c.email,
    checked_in_at: c.checked_in_at,
  }));
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

      // Fetch feedback + cohort data for all owned clients in parallel
      const [feedbackResults, cohortResults] = await Promise.all([
        Promise.all(validIds.map(id =>
          base44.asServiceRole.entities.FeedbackResponse.filter({ client_id: id, is_demo: { $ne: true } }, '-submitted_at', 200)
        )),
        Promise.all(validIds.map(id =>
          base44.asServiceRole.entities.CohortAssessment.filter({ client_id: id, is_demo: { $ne: true }, survey_type: { $ne: 'mfs' } }, '-submitted_at', 500)
        )),
      ]);

      const feedback = feedbackResults.flat().map(r => projectRow(r, PORTAL_FEEDBACK_FIELDS));
      const cohorts = cohortResults.flat().map(r => projectRow(r, PORTAL_COHORT_FIELDS));
      const checkins = await fetchCheckinsForClients(base44, validIds);
      return Response.json({ allowed: true, feedback_responses: feedback, cohort_assessments: cohorts, checkins });
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

    // Fetch feedback + cohort data for this client
    const [feedback, cohorts] = await Promise.all([
      base44.asServiceRole.entities.FeedbackResponse.filter({ client_id, is_demo: { $ne: true } }, '-submitted_at', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ client_id, is_demo: { $ne: true }, survey_type: { $ne: 'mfs' } }, '-submitted_at', 500),
    ]);

    const checkins = await fetchCheckinsForClients(base44, [client_id]);

    return Response.json({
      allowed: true,
      feedback_responses: feedback.map(r => projectRow(r, PORTAL_FEEDBACK_FIELDS)),
      cohort_assessments: cohorts.map(r => projectRow(r, PORTAL_COHORT_FIELDS)),
      checkins,
    });
  } catch (error) {
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
});