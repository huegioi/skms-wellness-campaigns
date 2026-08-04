import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Single data source for the client portal.
 * Input: token (no-login client access) OR client_id (admin preview).
 * Token: look up Client by portal_token via service role — no auth required.
 * client_id: caller must be an admin; non-admins get 403.
 * Returns: client, proposals, events (projected), email_templates, services.
 */

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || user.role === 'user' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch { /* no body */ }
    const { token, client_id } = body;

    // ── Resolve the client ──────────────────────────────────────────────
    let client = null;

    if (token) {
      // Token-based access — no auth required (mirrors referral portal)
      const byToken = await base44.asServiceRole.entities.Client.filter({ portal_token: token });
      client = byToken[0] || null;
    } else if (client_id) {
      // Admin preview — must be authenticated admin
      const user = await base44.auth.me();
      if (!user || !isTeamMember(user)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const byId = await base44.asServiceRole.entities.Client.filter({ id: client_id });
      client = byId[0] || null;
    }

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── Fetch all data in parallel ──────────────────────────────────────
    const [proposals, allEvents, emailTemplates, services, feedbackResponses, cohortAssessments] = await Promise.all([
      base44.asServiceRole.entities.Proposal.filter({ client_id: client.id }, '-created_date'),
      base44.asServiceRole.entities.CalendarEvent.list('start_date'),
      base44.asServiceRole.entities.EmailTemplate.list(),
      base44.asServiceRole.entities.Service.list('sort_order'),
      base44.asServiceRole.entities.FeedbackResponse.filter({ client_id: client.id, is_demo: { $ne: true } }, '-submitted_at', 200),
      base44.asServiceRole.entities.CohortAssessment.filter({ client_id: client.id, is_demo: { $ne: true }, survey_type: { $ne: 'mfs' } }, '-submitted_at', 500),
    ]);

    // Build service name lookup
    const serviceNameMap = {};
    for (const s of services) {
      serviceNameMap[s.id] = s.name;
    }

    // ── Event matching: exact client_id OR exact proposal_id ──
    // No fuzzy name/substring matching — that caused cross-client leaks.
    // An event whose proposal_id belongs to one of this client's proposals is safely theirs.
    const proposalIds = new Set(proposals.map(p => p.id));
    const matchedEvents = allEvents.filter(event => {
      if (event.client_id && event.client_id === client.id) return true;
      if (event.proposal_id && proposalIds.has(event.proposal_id)) return true;
      return false;
    });

    // ── Fetch check-ins for this client's events + by client_id ─────────
    const matchedEventIds = matchedEvents.filter(e => !e.is_demo).map(e => e.id);
    const checkinsByEvent = matchedEventIds.length > 0
      ? await base44.asServiceRole.entities.EventCheckin.filter(
          { event_id: { $in: matchedEventIds }, is_demo: { $ne: true } },
          '-checked_in_at',
          2000
        )
      : [];
    // Also fetch by client_id (new-style check-ins with direct attribution)
    const checkinsByClient = await base44.asServiceRole.entities.EventCheckin.filter(
      { client_id: client.id, is_demo: { $ne: true } },
      '-checked_in_at',
      2000
    );
    // Merge + dedupe by ID (event-based catches legacy; client_id catches new-style)
    const _checkinMap = new Map();
    for (const c of [...checkinsByEvent, ...checkinsByClient]) {
      _checkinMap.set(c.id, c);
    }
    const checkins = [..._checkinMap.values()].sort(
      (a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at)
    );

    // People engaged: distinct participant emails across pulse feedback + cohort assessments + check-ins
    const pulseEmails = new Set(
      feedbackResponses.map(r => (r.attendee_email || r.email_address || '').toLowerCase().trim()).filter(Boolean)
    );
    const cohortEmails = new Set(
      cohortAssessments.map(r => (r.participant_email || '').toLowerCase().trim()).filter(Boolean)
    );
    const checkinEmails = new Set(
      checkins.map(c => (c.email || '').toLowerCase().trim()).filter(Boolean)
    );
    const peopleEngaged = new Set([...pulseEmails, ...cohortEmails, ...checkinEmails]).size;

    // ── Project events to only portal-rendered fields ───────────────────
    const portalEvents = matchedEvents.filter(e => !e.is_demo).map(e => ({
      id: e.id,
      title: e.title,
      start_date: e.start_date,
      end_date: e.end_date,
      location: e.location,
      presenter: e.presenter,
      event_type: e.event_type,
      description: e.description,
      completed: e.completed,
      completed_date: e.completed_date,
      service_name: e.service_id ? (serviceNameMap[e.service_id] || null) : null,
      updated_date: e.updated_date,
    }));

    const PORTAL_CLIENT_FIELDS = [
      'id', 'name', 'email', 'email2', 'company', 'phone', 'title',
      'company_address', 'company_website', 'company_size', 'employee_count',
      'industry', 'portal_token', 'portal_template_ids', 'purchased_services',
      'portal_documents', 'session_resources', 'updated_date'
    ];
    const projectedClient = {};
    for (const f of PORTAL_CLIENT_FIELDS) {
      if (client[f] !== undefined) projectedClient[f] = client[f];
    }

    return Response.json({
      client: projectedClient,
      proposals,
      events: portalEvents,
      email_templates: emailTemplates,
      services,
      checkins,
      stats: { people_engaged: peopleEngaged },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});