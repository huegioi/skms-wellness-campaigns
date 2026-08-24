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

// Google only attaches a Meet when the request carries a createRequest AND the URL has
// conferenceDataVersion=1 (same pattern as bookFollowUpSession). requestId must be stable
// per event so a retry never spawns a second room.
function meetCreateRequest(event) {
  return {
    createRequest: {
      requestId: `skms-${event.id}`,
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  };
}
function extractMeetLink(gEvent) {
  return gEvent?.hangoutLink
    || gEvent?.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
    || '';
}

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
      let meetLink = event.meeting_link || '';
      const jsonHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

      if (googleEventId) {
        // Update existing event (PATCH — not PUT — to preserve attendees, conferenceData,
        // reminders, extendedProperties and colorId on the Google event.)
        // If the Google event has no Meet yet, ask for one in the same PATCH.
        let needsMeet = false;
        if (!meetLink) {
          const getRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${googleEventId}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (getRes.ok) {
            meetLink = extractMeetLink(await getRes.json());
            needsMeet = !meetLink;
          }
        }
        const patchBody = needsMeet ? { ...eventData, conferenceData: meetCreateRequest(event) } : eventData;
        const updateResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${googleEventId}?sendUpdates=none${needsMeet ? '&conferenceDataVersion=1' : ''}`,
          { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patchBody) }
        );

        if (!updateResponse.ok) {
          const error = await updateResponse.text();
          throw new Error(`Failed to update Google Calendar event: ${error}`);
        }
        const updated = await updateResponse.json();
        meetLink = extractMeetLink(updated) || meetLink;
      } else {
        // Create new event — with a Google Meet room attached.
        const createResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events?sendUpdates=none&conferenceDataVersion=1`,
          {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ ...eventData, conferenceData: meetCreateRequest(event) })
          }
        );

        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create Google Calendar event: ${error}`);
        }

        const result = await createResponse.json();
        googleEventId = result.id;
        meetLink = extractMeetLink(result);
      }

      // Meet creation is async on Google's side — if the link isn't in the response yet,
      // re-read the event once.
      if (googleEventId && !meetLink) {
        const again = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${googleEventId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (again.ok) meetLink = extractMeetLink(await again.json());
      }

      // Persist google_event_id + meeting_link (the check-in page hands meeting_link to
      // attendees after they check in).
      const patch = {};
      if (googleEventId !== event.google_event_id) patch.google_event_id = googleEventId;
      if (meetLink && meetLink !== event.meeting_link) patch.meeting_link = meetLink;
      if (Object.keys(patch).length) {
        await base44.asServiceRole.entities.CalendarEvent.update(eventId, patch);
      }

      return Response.json({ 
        success: true, 
        googleEventId,
        meetLink: meetLink || null,
        message: meetLink ? 'Event synced to Google Calendar with Meet link' : 'Event synced to Google Calendar (no Meet link returned)'
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

        // Clear google_event_id (and the Meet link — the room dies with the Google event)
        await base44.asServiceRole.entities.CalendarEvent.update(eventId, {
          google_event_id: null,
          meeting_link: null
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