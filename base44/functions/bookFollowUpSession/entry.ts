import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { clientId, leadId, startDateTime, endDateTime } = await req.json();
    if ((!clientId && !leadId) || !startDateTime || !endDateTime) {
      return Response.json({ error: 'clientId or leadId, startDateTime, and endDateTime are required' }, { status: 400 });
    }

    // Fetch client and/or lead
    let client = null;
    let lead = null;
    if (clientId) {
      const clients = await base44.entities.Client.filter({ id: clientId });
      client = clients[0];
      if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });
    }
    if (leadId) {
      const leads = await base44.entities.Lead.filter({ id: leadId });
      lead = leads[0];
      if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const contactName = client?.name || lead?.name || '';
    const companyName = client?.company || lead?.company || contactName;
    const eventTitle = `SkillfulMeans Wellness Services Check-in Call with ${companyName}`;

    // Get Google Calendar access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Build attendees — prefer client email, fall back to lead email
    const attendeeEmail = client?.email || lead?.email;
    const attendees = attendeeEmail ? [{ email: attendeeEmail }] : [];

    // Create event with Google Meet conference
    const eventBody = {
      summary: eventTitle,
      description: `Follow-up check-in call with ${contactName} from ${companyName}.\n\nScheduled via SkillfulMeans Wellness Services.`,
      start: { dateTime: startDateTime, timeZone: 'America/New_York' },
      end: { dateTime: endDateTime, timeZone: 'America/New_York' },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `skms-${clientId || leadId}-${Date.now()}`,
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

    // Save CalendarEvent entity so it shows in Scheduling Hub.
    // lead_id is passed through so the calendar ingestion can attribute the touch.
    const calEvent = await base44.entities.CalendarEvent.create({
      title: eventTitle,
      description: eventBody.description,
      event_type: 'follow_up',
      start_date: startDateTime,
      end_date: endDateTime,
      client_id: clientId || undefined,
      lead_id: leadId || undefined,
      client_name: contactName,
      location: meetLink,
      google_event_id: gcalEvent.id,
      completed: false
    });

    // Booking is not a contact — only update client follow-up status (not last_contacted_date for leads).
    // Lead last_contacted_date is set later by updateLastContactedFromCalendar once the call ends.
    if (clientId) {
      await base44.entities.Client.update(clientId, {
        follow_up_status: 'booked',
        last_contacted_date: new Date().toISOString().split('T')[0]
      });
    }

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