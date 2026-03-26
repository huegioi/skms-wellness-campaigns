import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    // The Google Calendar webhook fires when events change.
    // We look at the CalendarEvent entity for recently completed events
    // and sync their date to the linked client's last_contacted_date.

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Get events updated in the last 10 minutes from Google Calendar
    const updatedMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?updatedMin=${encodeURIComponent(updatedMin)}&singleEvents=true&orderBy=updated`,
      { headers: authHeader }
    );
    if (!calRes.ok) {
      const err = await calRes.text();
      console.error('Calendar API error:', err);
      return Response.json({ error: 'Calendar API error' }, { status: 500 });
    }

    const calData = await calRes.json();
    const events = calData.items || [];

    if (events.length === 0) {
      return Response.json({ message: 'No recent calendar updates' });
    }

    // Load all clients
    const clients = await base44.asServiceRole.entities.Client.list();

    for (const event of events) {
      const eventStart = event.start?.dateTime || event.start?.date;
      if (!eventStart) continue;

      const eventDate = new Date(eventStart);
      if (isNaN(eventDate.getTime())) continue;

      // Only consider past events (already happened)
      if (eventDate > new Date()) continue;

      const eventDateStr = eventDate.toISOString().split('T')[0];

      // Try to match a client from attendees or event title/description
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
          await base44.asServiceRole.entities.Client.update(client.id, {
            last_contacted_date: eventDateStr
          });
          console.log(`Updated last_contacted_date for ${client.name} to ${eventDateStr} (from Google Calendar)`);
        }
        break; // One client match per event is enough
      }
    }

    return Response.json({ message: 'Processed', eventCount: events.length });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});