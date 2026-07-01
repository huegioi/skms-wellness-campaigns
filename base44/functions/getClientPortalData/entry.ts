import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Single data source for the client portal.
 * Input: optional client_id (admin preview mode).
 * Authenticates the caller; non-admins are matched by email/email2.
 * Returns: client, proposals, events (projected), email_templates, services.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    let body = {};
    try { body = await req.json(); } catch { /* no body */ }
    const { client_id } = body;

    // ── Resolve the client ──────────────────────────────────────────────
    let client = null;

    if (user?.role === 'admin' && client_id) {
      const byId = await base44.asServiceRole.entities.Client.filter({ id: client_id });
      client = byId[0] || null;
    } else if (user?.email) {
      const byEmail = await base44.asServiceRole.entities.Client.filter({ email: user.email });
      if (byEmail.length > 0) {
        client = byEmail[0];
      } else {
        const byEmail2 = await base44.asServiceRole.entities.Client.filter({ email2: user.email });
        if (byEmail2.length > 0) {
          client = byEmail2[0];
        }
      }
    }

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── Fetch all data in parallel ──────────────────────────────────────
    const [proposals, allEvents, emailTemplates, services] = await Promise.all([
      base44.asServiceRole.entities.Proposal.filter({ client_id: client.id }, '-created_date'),
      base44.asServiceRole.entities.CalendarEvent.list('start_date'),
      base44.asServiceRole.entities.EmailTemplate.list(),
      base44.asServiceRole.entities.Service.list('sort_order'),
    ]);

    // Build service name lookup
    const serviceNameMap = {};
    for (const s of services) {
      serviceNameMap[s.id] = s.name;
    }

    // ── Event matching logic (copied verbatim from ClientPortal.jsx) ────
    const proposalIds = new Set(proposals.map(p => p.id));
    const clientNameLower = client.name?.toLowerCase().trim() || '';
    const clientCompanyLower = client.company?.toLowerCase().trim() || '';

    const matchedEvents = allEvents.filter(event => {
      const eventClientLower = event.client_name?.toLowerCase().trim() || '';

      if (event.client_id && event.client_id === client.id) return true;
      if (event.proposal_id && proposalIds.has(event.proposal_id)) return true;

      if (!eventClientLower) return false;

      if (clientNameLower && eventClientLower === clientNameLower) return true;
      if (clientCompanyLower && eventClientLower === clientCompanyLower) return true;

      if (clientNameLower && clientNameLower.length > 5 && clientNameLower.includes(eventClientLower)) return true;
      if (clientNameLower && eventClientLower.length > 5 && eventClientLower.includes(clientNameLower)) return true;
      if (clientCompanyLower && clientCompanyLower.length > 5 && clientCompanyLower.includes(eventClientLower)) return true;
      if (clientCompanyLower && eventClientLower.length > 5 && eventClientLower.includes(clientCompanyLower)) return true;

      return false;
    });

    // ── Project events to only portal-rendered fields ───────────────────
    const portalEvents = matchedEvents.map(e => ({
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

    return Response.json({
      client,
      proposals,
      events: portalEvents,
      email_templates: emailTemplates,
      services,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});