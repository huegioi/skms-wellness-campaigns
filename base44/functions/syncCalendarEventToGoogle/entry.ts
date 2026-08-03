import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const APP_BASE_URL = 'https://app.skillfulmeans.life';
function buildCheckinUrl(token) {
  if (!token) return null;
  return `${APP_BASE_URL}/Checkin?t=${token}`;
}
function buildInviteDescription(event, service) {
  const parts = [];
  const checkinUrl = buildCheckinUrl(event?.checkin_token);
  if (checkinUrl) {
    parts.push('CHECK IN HERE:');
    parts.push(checkinUrl);
    parts.push('Please check in at this link when the session starts. Your video link will appear right after you check in.');
    parts.push('');
  }
  if (service?.description) parts.push(service.description);
  else if (service?.short_description) parts.push(service.short_description);
  if (service?.key_benefits?.length) {
    parts.push('');
    parts.push('Key Benefits:');
    service.key_benefits.forEach(b => parts.push('• ' + b));
  }
  if (event?.description) {
    const existing = String(event.description).trim();
    if (existing && !parts.join('\n').includes(existing)) {
      parts.push('');
      parts.push(existing);
    }
  }
  parts.push('');
  parts.push('— SkillfulMeans Wellness Services');
  return parts.join('\n').trim();
}

const CALENDAR_ID = 'admin%40skillfulmeans.life';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, action } = await req.json();

    // Get the calendar event
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: eventId });
    if (!events.length) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = events[0];

    // Demo events are never synced to Google Calendar
    if (event.is_demo) {
      return Response.json({ success: true, skipped: true, reason: 'demo_record' });
    }

    // Get access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    if (action === 'sync') {
      // Fetch the service so the invite description can include its copy.
      let service = null;
      if (event.service_id) {
        try {
          const services = await base44.asServiceRole.entities.Service.filter({ id: event.service_id });
          service = services[0] || null;
        } catch { /* non-fatal */ }
      }
      const checkinUrl = buildCheckinUrl(event.checkin_token);
      // Create or update in Google Calendar
      const eventData = {
        summary: event.title,
        description: event.checkin_token ? buildInviteDescription(event, service) : (event.description || ''),
        location: event.checkin_token ? (checkinUrl || '') : (event.location || ''),
        start: event.all_day 
          ? { date: event.start_date.split('T')[0] }
          : { dateTime: event.start_date, timeZone: 'America/New_York' },
        end: event.all_day
          ? { date: event.end_date?.split('T')[0] || event.start_date.split('T')[0] }
          : { dateTime: event.end_date || event.start_date, timeZone: 'America/New_York' }
      };

      let googleEventId = event.google_event_id;

      if (googleEventId) {
        // Update existing event (PATCH — not PUT — to preserve attendees, conferenceData,
        // reminders, extendedProperties and colorId on the Google event.)
        const updateResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${googleEventId}?sendUpdates=none`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          }
        );

        if (!updateResponse.ok) {
          const error = await updateResponse.text();
          throw new Error(`Failed to update Google Calendar event: ${error}`);
        }
      } else {
        // Create new event
        const createResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events?sendUpdates=none`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          }
        );

        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create Google Calendar event: ${error}`);
        }

        const result = await createResponse.json();
        googleEventId = result.id;

        // Update CalendarEvent with google_event_id
        await base44.asServiceRole.entities.CalendarEvent.update(eventId, {
          google_event_id: googleEventId
        });
      }

      return Response.json({ 
        success: true, 
        googleEventId,
        message: 'Event synced to Google Calendar'
      });

    } else if (action === 'unsync') {
      // Remove from Google Calendar
      if (event.google_event_id) {
        const deleteResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${event.google_event_id}?sendUpdates=none`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const error = await deleteResponse.text();
          throw new Error(`Failed to delete Google Calendar event: ${error}`);
        }

        // Clear google_event_id from CalendarEvent
        await base44.asServiceRole.entities.CalendarEvent.update(eventId, {
          google_event_id: null
        });
      }

      return Response.json({ 
        success: true,
        message: 'Event removed from Google Calendar'
      });

    } else if (action === 'delete') {
      // Delete from Google Calendar if synced
      if (event.google_event_id) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${event.google_event_id}?sendUpdates=none`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});