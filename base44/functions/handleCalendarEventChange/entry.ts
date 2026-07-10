import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Shared multi-calendar watch list. Keep in sync with updateLastContactedFromCalendar.
const WATCHED_CALENDARS = [
  { id: 'primary', owner: 'William' },
  { id: 'heather@skillfulmeans.life', owner: 'Heather' },
  { id: 'admin@skillfulmeans.life', owner: null },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Demo events are never synced to Google Calendar
    if (data?.is_demo || old_data?.is_demo) {
      return Response.json({ success: true, message: 'Demo event — skipping Google sync' });
    }

    // Only proceed if event has google_event_id (is synced)
    if (!data?.google_event_id && !old_data?.google_event_id) {
      return Response.json({ success: true, message: 'Event not synced, skipping' });
    }

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const jsonHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Determine candidate calendars: prefer the event's source_calendar, then try the rest.
    const source = data?.source_calendar || old_data?.source_calendar;
    const candidateCals = source
      ? [source, ...WATCHED_CALENDARS.filter(c => c.id !== source).map(c => c.id)]
      : WATCHED_CALENDARS.map(c => c.id);

    if (event.type === 'delete') {
      if (old_data?.google_event_id) {
        for (const calId of candidateCals) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${old_data.google_event_id}`,
            { method: 'DELETE', headers: authHeaders }
          );
          if (res.ok) break;          // deleted successfully on this calendar
          if (res.status === 404) continue; // not on this calendar — try the next
          console.error(`Delete failed on ${calId}: ${await res.text()}`);
        }
      }
      return Response.json({ success: true, message: 'Processed delete across watched calendars' });
    }

    if (event.type === 'update' && data.google_event_id) {
      const eventData = {
        summary: data.title,
        description: data.description || '',
        location: data.location || '',
        start: data.all_day
          ? { date: data.start_date.split('T')[0] }
          : { dateTime: data.start_date, timeZone: 'America/New_York' },
        end: data.all_day
          ? { date: data.end_date?.split('T')[0] || data.start_date.split('T')[0] }
          : { dateTime: data.end_date || data.start_date, timeZone: 'America/New_York' }
      };

      let updated = false;
      for (const calId of candidateCals) {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${data.google_event_id}`,
          { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(eventData) }
        );
        if (res.ok) { updated = true; break; }
        if (res.status === 404) continue; // not on this calendar — try the next
        console.error(`Update failed on ${calId}: ${await res.text()}`);
      }

      if (!updated) {
        return Response.json({
          success: false,
          error: 'Failed to update Google Calendar event on any watched calendar'
        }, { status: 500 });
      }
      return Response.json({ success: true, message: 'Updated in Google Calendar' });
    }

    return Response.json({ success: true, message: 'No action needed' });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});