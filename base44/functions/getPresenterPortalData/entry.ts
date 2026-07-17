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
    const presenterFullName = (presenter.name || '').trim();
    const presenterFirstName = presenterFullName.split(' ')[0];

    // Check if first name is unique among all presenters (to avoid ambiguous matches)
    let firstNameIsUnique = false;
    if (presenterFirstName && presenterFirstName !== presenterFullName) {
      const allPresenters = await base44.asServiceRole.entities.Presenter.list('name', 500);
      const matchingFirst = allPresenters.filter(p =>
        (p.name || '').trim().split(' ')[0].toLowerCase() === presenterFirstName.toLowerCase()
      );
      firstNameIsUnique = matchingFirst.length === 1;
    }

    // Fetch events by presenter_id, full name, and (if unique) first name — in parallel
    const queries = [
      base44.asServiceRole.entities.CalendarEvent.filter({ presenter_id: presenter.id }, 'start_date', 500),
      presenterFullName
        ? base44.asServiceRole.entities.CalendarEvent.filter({ presenter: presenterFullName }, 'start_date', 500)
        : Promise.resolve([]),
      firstNameIsUnique
        ? base44.asServiceRole.entities.CalendarEvent.filter({ presenter: presenterFirstName }, 'start_date', 500)
        : Promise.resolve([])
    ];

    const [byId, byFullName, byFirstName] = await Promise.all(queries);

    // Merge and deduplicate by event id
    const seen = new Set();
    const allEvents = [];
    for (const e of [...byId, ...byFullName, ...byFirstName]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        allEvents.push(e);
      }
    }

    const today = new Date().toISOString();
    const upcoming = allEvents.filter(e => e.start_date >= today).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const past = allEvents.filter(e => e.start_date < today).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    const clientIds = [...new Set(allEvents.map(e => e.client_id).filter(Boolean))];
    const serviceIds = [...new Set(allEvents.map(e => e.service_id).filter(Boolean))];

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

    // Fetch assessment responses for facilitation checklist (all 4 survey types)
    const [day0Assessments, day14Assessments, cohortStartAssessments, cohortEndAssessments] = await Promise.all([
      base44.asServiceRole.entities.CohortAssessment.filter({ survey_type: 'challenge_day0' }, '-submitted_at', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ survey_type: 'challenge_day14' }, '-submitted_at', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ survey_type: 'cohort_start' }, '-submitted_at', 500),
      base44.asServiceRole.entities.CohortAssessment.filter({ survey_type: 'cohort_end' }, '-submitted_at', 500),
    ]);
    const day0Counts = new Map();
    for (const a of day0Assessments) {
      const k = `${a.client_id}|${a.service_id}`;
      day0Counts.set(k, (day0Counts.get(k) || 0) + 1);
    }
    const day14Counts = new Map();
    for (const a of day14Assessments) {
      const k = `${a.client_id}|${a.service_id}`;
      day14Counts.set(k, (day14Counts.get(k) || 0) + 1);
    }
    const cohortStartCounts = new Map();
    for (const a of cohortStartAssessments) {
      const k = `${a.client_id}|${a.service_id}`;
      cohortStartCounts.set(k, (cohortStartCounts.get(k) || 0) + 1);
    }
    const cohortEndCounts = new Map();
    for (const a of cohortEndAssessments) {
      const k = `${a.client_id}|${a.service_id}`;
      cohortEndCounts.set(k, (cohortEndCounts.get(k) || 0) + 1);
    }

    // Fetch check-in counts per event
    const eventIds = allEvents.map(e => e.id).filter(Boolean);
    const checkinCountMap = new Map();
    if (eventIds.length > 0) {
      const allCheckins = await base44.asServiceRole.entities.EventCheckin.filter({}, '-checked_in_at', 500);
      for (const c of allCheckins) {
        if (c.event_id) {
          checkinCountMap.set(c.event_id, (checkinCountMap.get(c.event_id) || 0) + 1);
        }
      }
    }

    const getSessionFee = (event) => {
      if (event.presenter_fee != null && event.presenter_fee !== '') return Number(event.presenter_fee);
      if (presenter.default_rate != null) return Number(presenter.default_rate);
      return null;
    };

    const enrichEvent = (event) => {
      const client = clientMap[event.client_id] || null;
      const service = serviceMap[event.service_id] || null;

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
        presenter_paid: event.presenter_paid || false,
        presenter_paid_date: event.presenter_paid_date || null,
        session_fee: getSessionFee(event),
        recording_link: event.recording_link || '',
        description: event.description,
        service_id: event.service_id,
        service_name: service?.name || null,
        service_category: service?.category || null,
        service_included_assessments: service?.included_assessments || [],
        assessment_timing: event.assessment_timing || 'none',
        assessment_counts: event.client_id && event.service_id ? {
          day0: day0Counts.get(`${event.client_id}|${event.service_id}`) || 0,
          day14: day14Counts.get(`${event.client_id}|${event.service_id}`) || 0,
          baseline: (event.event_type === 'challenge' || service?.category === 'challenge')
            ? (day0Counts.get(`${event.client_id}|${event.service_id}`) || 0)
            : (cohortStartCounts.get(`${event.client_id}|${event.service_id}`) || 0),
          endpoint: (event.event_type === 'challenge' || service?.category === 'challenge')
            ? (day14Counts.get(`${event.client_id}|${event.service_id}`) || 0)
            : (cohortEndCounts.get(`${event.client_id}|${event.service_id}`) || 0),
        } : null,
        checkin_count: checkinCountMap.get(event.id) || 0,
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
        presenter_materials: service?.presenter_materials || [],
        presenter_notes: service?.presenter_notes || '',
        attendee_count: client?.employee_count || null,
        survey_links: surveyLinks,
      };
    };

    const enrichedUpcoming = upcoming.map(enrichEvent);
    const enrichedPast = past.map(enrichEvent);
    const allEnriched = [...enrichedUpcoming, ...enrichedPast];

    const completedSessions = allEnriched.filter(e => e.completed);
    const earnings = {
      total_pending: completedSessions.filter(e => !e.presenter_paid).reduce((s, e) => s + (e.session_fee || 0), 0),
      total_paid: completedSessions.filter(e => e.presenter_paid).reduce((s, e) => s + (e.session_fee || 0), 0),
      has_rate: presenter.default_rate != null,
    };

    return Response.json({
      presenter: {
        id: presenter.id,
        name: presenter.name,
        email: presenter.email,
        is_active: presenter.is_active,
        default_rate: presenter.default_rate,
      },
      upcoming: enrichedUpcoming,
      past: enrichedPast,
      earnings,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});