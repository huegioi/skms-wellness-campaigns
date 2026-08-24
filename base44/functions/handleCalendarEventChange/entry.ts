import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    // Only proceed if event has google_event_id (is synced) or a Meet holder
    if (!data?.google_event_id && !old_data?.google_event_id && !old_data?.google_meet_event_id) {
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
      // Delete the client-facing event AND its private Meet-room holder (see
      // syncCalendarEventToGoogle — the Meet lives on a separate event so invitees
      // never see two links).
      for (const gid of [old_data?.google_event_id, old_data?.google_meet_event_id].filter(Boolean)) {
        for (const calId of candidateCals) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${gid}?sendUpdates=none`,
            { method: 'DELETE', headers: authHeaders }
          );
          if (res.ok) break;          // deleted successfully on this calendar
          if (res.status === 404 || res.status === 410) continue; // not on this calendar — try the next
          console.error(`Delete failed on ${calId}: ${await res.text()}`);
        }
      }
      return Response.json({ success: true, message: 'Processed delete across watched calendars' });
    }

    if (event.type === 'update' && data.google_event_id) {
      // Fetch the service so the invite description can include its copy.
      let service = null;
      if (data.service_id) {
        try {
          const services = await base44.asServiceRole.entities.Service.filter({ id: data.service_id });
          service = services[0] || null;
        } catch { /* non-fatal — invite description simply omits service copy */ }
      }
      const checkinUrl = buildCheckinUrl(data.checkin_token);
      const eventData = {
        summary: data.title,
        description: data.checkin_token ? buildInviteDescription(data, service) : (data.description || ''),
        location: data.checkin_token ? (checkinUrl || '') : (data.location || ''),
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
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${data.google_event_id}?sendUpdates=none`,
          { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(eventData) }
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

      // Keep the Meet-room holder on the session's time/title (non-fatal).
      if (data.google_meet_event_id) {
        const holderPatch = { summary: `Meet room · ${data.title}`, start: eventData.start, end: eventData.end };
        for (const calId of candidateCals) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${data.google_meet_event_id}?sendUpdates=none`,
            { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(holderPatch) }
          );
          if (res.ok) break;
          if (res.status === 404 || res.status === 410) continue;
          console.error(`Holder update failed on ${calId}: ${await res.text()}`);
          break;
        }
      }
      return Response.json({ success: true, message: 'Updated in Google Calendar' });
    }

    return Response.json({ success: true, message: 'No action needed' });
  } catch (error) {
    console.error('Calendar sync error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});