import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Public endpoint for the anonymous (in-room) attendee pulse form.
 * Returns display-only context the form needs: service name/category, company
 * name, and the MOST RECENT PAST event for the service (+ client).
 *
 * This is a public endpoint — returns names only, never emails, notes, tokens,
 * or arrays of records. All reads use the service role (bypassing RLS) so
 * unauthenticated visitors get real data instead of empty RLS results.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch { /* no body */ }
    const { service_id, client_id } = body;

    if (!service_id) {
      return Response.json({ error: 'service_id is required' }, { status: 400 });
    }

    // Service name + category (service role)
    const services = await base44.asServiceRole.entities.Service.filter({ id: service_id });
    const service = services[0] || null;
    const service_name = service?.name || '';
    const service_category = service?.category || null;

    // Company name (service role) — only if a client_id was provided
    let company_name = '';
    if (client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
      company_name = clients[0]?.company || '';
    }

    // Most recent PAST event for this service (+ client), demo excluded
    const nowIso = new Date().toISOString();
    const eventFilter: any = { service_id, start_date: { $lte: nowIso }, is_demo: { $ne: true } };
    if (client_id) eventFilter.client_id = client_id;
    const events = await base44.asServiceRole.entities.CalendarEvent.filter(eventFilter, '-start_date', 1);
    const pastEvent = events[0] || null;

    return Response.json({
      service_name,
      service_category,
      company_name,
      event: pastEvent
        ? { event_id: pastEvent.id, presenter: pastEvent.presenter || null, delivery_format: pastEvent.delivery_format || null }
        : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});