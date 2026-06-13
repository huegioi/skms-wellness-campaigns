import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { portal_id } = await req.json();

    if (!portal_id) {
      return Response.json({ error: 'portal_id is required' }, { status: 400 });
    }

    const presenters = await base44.asServiceRole.entities.Presenter.filter({ unique_portal_id: portal_id });
    if (!presenters || presenters.length === 0) {
      return Response.json({ error: 'Presenter not found' }, { status: 404 });
    }
    const presenter = presenters[0];
    const presenterNameLower = (presenter.name || '').trim().toLowerCase();

    // Fetch by presenter_id (canonical) AND by legacy free-text presenter name
    const [byId, byName] = await Promise.all([
      base44.asServiceRole.entities.CalendarEvent.filter({ presenter_id: presenter.id }, 'start_date', 500),
      presenterNameLower
        ? base44.asServiceRole.entities.CalendarEvent.filter({ presenter: presenter.name }, 'start_date', 500)
        : Promise.resolve([])
    ]);

    // Merge, deduplicate by event id, prefer the byId record if both exist
    const seen = new Set();
    const allEvents = [];
    for (const e of [...byId, ...byName]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        allEvents.push(e);
      }
    }

    const today = new Date().toISOString();
    const upcoming = allEvents.filter(e => e.start_date >= today).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const past = allEvents.filter(e => e.start_date < today).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    // Collect unique client IDs and service IDs
    const clientIds = [...new Set(allEvents.map(e => e.client_id).filter(Boolean))];
    const serviceIds = [...new Set(allEvents.map(e => e.service_id).filter(Boolean))];

    // Fetch clients and services in parallel
    const [clientResults, serviceResults] = await Promise.all([
      clientIds.length > 0
        ? Promise.all(clientIds.map(id => base44.asServiceRole.entities.Client.filter({ id }).then(r => r[0] || null)))
        : Promise.resolve([]),
      serviceIds.length > 0
        ? Promise.all(serviceIds.map(id => base44.asServiceRole.entities.Service.filter({ id }).then(r => r[0] || null)))
        : Promise.resolve([])
    ]);

    const clientMap = {};
    clientResults.forEach(c => { if (c) clientMap[c.id] = c; });

    const serviceMap = {};
    serviceResults.forEach(s => { if (s) serviceMap[s.id] = s; });

    const enrichEvent = (event) => {
      const client = clientMap[event.client_id] || null;
      const service = serviceMap[event.service_id] || null;

      // Build survey links — never include scores
      const surveyLinks = {};
      if (event.service_id && event.client_id) {
        surveyLinks.pulse = `/AttendeeForm?service_id=${event.service_id}&client_id=${event.client_id}`;
        if (service?.category === 'challenge') {
          surveyLinks.challenge_day0 = `/CohortAssessment?service_id=${event.service_id}&client_id=${event.client_id}&timing=day0`;
          surveyLinks.challenge_day14 = `/CohortAssessment?service_id=${event.service_id}&client_id=${event.client_id}&timing=day14`;
        }
      }

      return {
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
        event_type: event.event_type,
        completed: event.completed,
        presenter_accepted: event.presenter_accepted,
        description: event.description,
        service_id: event.service_id,
        client_id: event.client_id,
        client_name: event.client_name,
        client_context: client ? {
          name: client.name,
          company: client.company,
          company_size: client.company_size,
          industry: client.industry,
          notes: client.notes,
        } : null,
        materials: service?.resources?.map(r => ({ title: r.title, file_url: r.file_url, resource_type: r.resource_type })) || [],
        survey_links: surveyLinks,
      };
    };

    return Response.json({
      presenter: {
        id: presenter.id,
        name: presenter.name,
        email: presenter.email,
        is_active: presenter.is_active,
      },
      upcoming: upcoming.map(enrichEvent),
      past: past.map(enrichEvent),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});