import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientId, startDateTime, endDateTime } = await req.json();
    if (!clientId || !startDateTime || !endDateTime) {
      return Response.json({ error: 'clientId, startDateTime, and endDateTime are required' }, { status: 400 });
    }

    // Fetch client
    const clients = await base44.entities.Client.filter({ id: clientId });
    const client = clients[0];
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const companyName = client.company || client.name;
    const eventTitle = `SkillfulMeans Wellness Services Check-in Call with ${companyName}`;

    // Get Google Calendar access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Build attendees
    const attendees = [{ email: client.email }];

    // Create event with Google Meet conference
    const eventBody = {
      summary: eventTitle,
      description: `Follow-up check-in call with ${client.name} from ${companyName}.\n\nScheduled via SkillfulMeans Wellness Services.`,
      start: { dateTime: startDateTime, timeZone: 'America/New_York' },
      end: { dateTime: endDateTime, timeZone: 'America/New_York' },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `skms-${clientId}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    const gcalRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventBody)
      }
    );

    if (!gcalRes.ok) {
      const err = await gcalRes.text();
      return Response.json({ error: `Google Calendar error: ${err}` }, { status: 500 });
    }

    const gcalEvent = await gcalRes.json();
    const meetLink = gcalEvent.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || '';

    // Save CalendarEvent entity so it shows in Scheduling Hub
    const calEvent = await base44.entities.CalendarEvent.create({
      title: eventTitle,
      description: eventBody.description,
      event_type: 'follow_up',
      start_date: startDateTime,
      end_date: endDateTime,
      client_id: clientId,
      client_name: client.name,
      location: meetLink,
      google_event_id: gcalEvent.id,
      completed: false
    });

    // Update client follow_up_status to booked
    await base44.entities.Client.update(clientId, {
      follow_up_status: 'booked',
      last_contacted_date: new Date().toISOString().split('T')[0]
    });

    return Response.json({
      success: true,
      calendarEvent: calEvent,
      googleEventId: gcalEvent.id,
      meetLink
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});