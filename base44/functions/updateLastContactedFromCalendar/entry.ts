import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Shared multi-calendar watch list. Keep in sync with handleCalendarEventChange.
// Calendars must be shared with the connected Google account (read access).
// owner maps a calendar to the team member whose touches should be attributed.
const WATCHED_CALENDARS = [
  { id: 'primary', owner: 'William' },
  { id: 'heather@skillfulmeans.life', owner: 'Heather' },
  { id: 'admin@skillfulmeans.life', owner: null },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const updatedMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Load clients, leads, recent CalendarEvents, and interactions with a calendar link
    const [clients, leads, calEvents, recentInteractions] = await Promise.all([
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.Lead.list(),
      base44.asServiceRole.entities.CalendarEvent.list('-start_date', 500),
      base44.asServiceRole.entities.ClientInteraction.list('-date', 500),
    ]);

    // Index CalendarEvents by google_event_id (to set source_calendar on ingest)
    const calEventByGoogleId = {};
    for (const ce of calEvents) {
      if (ce.google_event_id) calEventByGoogleId[ce.google_event_id] = ce;
    }

    // Set of calendar_event_ids that already have a logged interaction (dedup for Part B)
    const processedEventIds = new Set(
      (recentInteractions || []).filter(i => i.calendar_event_id).map(i => i.calendar_event_id)
    );

    let clientsUpdated = 0;
    let sourceCalendarSet = 0;

    // PART A: Ingest recent Google events from each watched calendar
    for (const cal of WATCHED_CALENDARS) {
      let events = [];
      try {
        const calRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?updatedMin=${encodeURIComponent(updatedMin)}&singleEvents=true&orderBy=updated`,
          { headers: authHeader }
        );
        if (!calRes.ok) {
          console.error(`Calendar ${cal.id} API error: ${await calRes.text()}`);
          continue;
        }
        const calData = await calRes.json();
        events = calData.items || [];
      } catch (e) {
        console.error(`Failed to fetch calendar ${cal.id}:`, e.message);
        continue;
      }

      for (const event of events) {
        const eventStart = event.start?.dateTime || event.start?.date;
        if (!eventStart) continue;
        const eventDate = new Date(eventStart);
        if (isNaN(eventDate.getTime())) continue;
        if (eventDate > new Date()) continue; // only past events

        const eventDateStr = eventDate.toISOString().split('T')[0];

        // Record which calendar this event came from on the matching CalendarEvent entity
        if (event.id && calEventByGoogleId[event.id]) {
          const ce = calEventByGoogleId[event.id];
          if (!ce.source_calendar) {
            await base44.asServiceRole.entities.CalendarEvent.update(ce.id, { source_calendar: cal.id });
            ce.source_calendar = cal.id;
            sourceCalendarSet++;
          }
        }

        // Match to a client by attendees / title / description (existing logic)
        const attendeeEmails = (event.attendees || []).map(a => a.email?.toLowerCase()).filter(Boolean);
        const summaryLower = (event.summary || '').toLowerCase();
        const descriptionLower = (event.description || '').toLowerCase();

        for (const client of clients) {
          if (!client.email) continue;
          const clientEmailLower = client.email.toLowerCase();
          const clientNameLower = (client.name || '').toLowerCase();
          const clientCompanyLower = (client.company || '').toLowerCase();

          const matched =
            attendeeEmails.includes(clientEmailLower) ||
            summaryLower.includes(clientNameLower) ||
            summaryLower.includes(clientCompanyLower) ||
            descriptionLower.includes(clientEmailLower);

          if (!matched) continue;

          const existing = client.last_contacted_date;
          if (!existing || eventDateStr > existing) {
            await base44.asServiceRole.entities.Client.update(client.id, { last_contacted_date: eventDateStr });
            clientsUpdated++;
          }
          break; // one client match per event is enough
        }
      }
    }

    // PART B: Process lead-linked events that have ended.
    // Booking is not a contact, so last_contacted_date is NOT touched at create time.
    // Once the event is in the past, log a meeting Interaction (dated at event start)
    // and set the lead's last_contacted_date to the event date.
    const now = new Date();
    const ownerByCalendar = {};
    for (const c of WATCHED_CALENDARS) ownerByCalendar[c.id] = c.owner;

    const leadById = {};
    for (const l of leads) leadById[l.id] = l;

    let interactionsCreated = 0;
    let leadsUpdated = 0;

    for (const ce of calEvents) {
      if (!ce.lead_id || !ce.start_date) continue;
      const start = new Date(ce.start_date);
      if (isNaN(start.getTime()) || start > now) continue; // only past events
      if (processedEventIds.has(ce.id)) continue; // already logged

      const owner = ce.source_calendar ? ownerByCalendar[ce.source_calendar] : null;

      await base44.asServiceRole.entities.ClientInteraction.create({
        lead_id: ce.lead_id,
        channel: 'meeting',
        interaction_type: 'meeting',
        subject: ce.title || 'Meeting',
        calendar_event_id: ce.id,
        date: ce.start_date,
        owner: owner || undefined,
      });
      interactionsCreated++;

      const eventDateStr = start.toISOString().split('T')[0];
      const lead = leadById[ce.lead_id];
      if (lead && (!lead.last_contacted_date || eventDateStr > lead.last_contacted_date)) {
        await base44.asServiceRole.entities.Lead.update(ce.lead_id, { last_contacted_date: eventDateStr });
        leadsUpdated++;
      }
    }

    return Response.json({
      message: 'Processed',
      calendarsWatched: WATCHED_CALENDARS.length,
      clientsUpdated,
      sourceCalendarSet,
      interactionsCreated,
      leadsUpdated,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});