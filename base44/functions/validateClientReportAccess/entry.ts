import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { shouldExcludeDemo, demoExclusion } from '../../shared/demoPortal.ts';

/**
 * Validates access to a client report and returns the data the report needs.
 * Accepts, in priority order:
 *   1. portal_id  — broker path (existing ownership check: partner owns this client)
 *   2. token      — client portal_token (must match the requested client_id's Client)
 *   3. admin      — authenticated admin caller
 * Anything else returns { allowed: false }.
 * When allowed, also returns client + responses + services (service role, filtered to client).
 */

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { portal_id, token, client_id } = body;

    if (!client_id) {
      return Response.json({ allowed: false, error: 'client_id is required' }, { status: 400 });
    }

    let allowed = false;
    let partner_id = null;

    // ── Priority 1: portal_id (broker path — existing ownership check) ──
    if (portal_id) {
      const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
      if (partners && partners.length > 0) {
        const partner = partners[0];
        const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id, referral_partner_id: partner.id });
        if (clients && clients.length > 0) {
          allowed = true;
          partner_id = partner.id;
        }
      }
    }

    // ── Priority 2: token (client portal_token must match the client_id) ──
    if (!allowed && token) {
      const tokenClients = await base44.asServiceRole.entities.Client.filter({ portal_token: token });
      if (tokenClients && tokenClients.length > 0 && tokenClients[0].id === client_id) {
        allowed = true;
      }
    }

    // ── Priority 3: authenticated admin ──
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

    // ── Resolve the owning client first so a demo client's own portal shows
    // its demo rows (real client → demo rows excluded). ──
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const ownerClient = clients[0] || null;
    const excludeDemo = shouldExcludeDemo(ownerClient);
    const demoFrag = demoExclusion(excludeDemo);

    // ── Fetch client + feedback data (service role, filtered to this client) ──
    const [responses, services, events, cohortAssessments] = await Promise.all([
      base44.asServiceRole.entities.FeedbackResponse.filter({ client_id, ...demoFrag }, '-submitted_at', 500),
      base44.asServiceRole.entities.Service.list('sort_order'),
      base44.asServiceRole.entities.CalendarEvent.filter({ client_id, ...demoFrag }, '-start_date', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ client_id, ...demoFrag, survey_type: { $ne: 'mfs' } }, '-submitted_at', 500),
    ]);

    // Fetch check-ins for this client's events
    const eventIds = events.map(e => e.id);
    const checkins = eventIds.length > 0
      ? await base44.asServiceRole.entities.EventCheckin.filter(
          { event_id: { $in: eventIds }, ...demoFrag },
          '-checked_in_at',
          2000
        )
      : [];

    const PORTAL_CLIENT_FIELDS = [
      'id', 'name', 'email', 'email2', 'company', 'phone', 'title',
      'company_address', 'company_website', 'company_size', 'employee_count',
      'industry', 'portal_template_ids', 'purchased_services',
      'portal_documents', 'session_resources', 'updated_date'
    ];
    const rawClient = clients[0] || null;
    const projectedClient = rawClient ? {} : null;
    if (rawClient) {
      for (const f of PORTAL_CLIENT_FIELDS) {
        if (rawClient[f] !== undefined) projectedClient[f] = rawClient[f];
      }
    }

    return Response.json({
      allowed: true,
      partner_id,
      client_id,
      client: projectedClient,
      responses,
      services,
      events: events.map(e => ({ id: e.id, title: e.title, start_date: e.start_date, completed: e.completed })),
      checkins: checkins.map(c => ({ event_id: c.event_id, email: c.email, checked_in_at: c.checked_in_at })),
      cohort_assessments: cohortAssessments.map(r => projectRow(r, PORTAL_COHORT_FIELDS)),
    });
  } catch (error) {
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
});