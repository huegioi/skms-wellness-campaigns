import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const [allEvents, allServices, allClients] = await Promise.all([
      base44.asServiceRole.entities.CalendarEvent.list('start_date', 2000),
      base44.asServiceRole.entities.Service.list('name', 500),
      base44.asServiceRole.entities.Client.list('name', 500),
    ]);

    // Build lookup maps: normalized name -> record (null if ambiguous)
    const serviceByName = {};
    allServices.forEach(s => {
      const key = (s.name || '').trim().toLowerCase();
      serviceByName[key] = serviceByName[key] ? null : s;
    });

    const clientByName = {};
    allClients.forEach(c => {
      // Try both name and company
      const keyName = (c.name || '').trim().toLowerCase();
      const keyCompany = (c.company || '').trim().toLowerCase();
      if (keyName) clientByName[keyName] = clientByName[keyName] ? null : c;
      if (keyCompany && keyCompany !== keyName) {
        clientByName[keyCompany] = clientByName[keyCompany] ? null : c;
      }
    });

    let serviceLinked = 0;
    let clientLinked = 0;
    let skipped = 0;
    const details = [];

    for (const event of allEvents) {
      const needsService = !event.service_id;
      const needsClient = !event.client_id;

      if (!needsService && !needsClient) continue;

      const update = {};
      const eventDetails = { event_id: event.id, title: event.title };

      // Try to match service_id by event title
      if (needsService) {
        const titleKey = (event.title || '').trim().toLowerCase();
        const matched = serviceByName[titleKey];
        if (matched) {
          update.service_id = matched.id;
          serviceLinked++;
          eventDetails.service_matched = matched.name;
        } else {
          eventDetails.service_result = matched === null ? 'ambiguous' : 'no_match';
        }
      }

      // Try to match client_id by client_name
      if (needsClient && event.client_name) {
        const nameKey = (event.client_name || '').trim().toLowerCase();
        const matched = clientByName[nameKey];
        if (matched) {
          update.client_id = matched.id;
          clientLinked++;
          eventDetails.client_matched = matched.name || matched.company;
        } else {
          eventDetails.client_result = matched === null ? 'ambiguous' : 'no_match';
        }
      }

      if (Object.keys(update).length > 0) {
        await base44.asServiceRole.entities.CalendarEvent.update(event.id, update);
        eventDetails.updated = true;
      } else {
        skipped++;
        eventDetails.updated = false;
      }

      details.push(eventDetails);
    }

    return Response.json({
      total_processed: allEvents.filter(e => !e.service_id || !e.client_id).length,
      service_linked: serviceLinked,
      client_linked: clientLinked,
      skipped_no_match: skipped,
      details: details.filter(d => d.updated || d.service_result || d.client_result),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});