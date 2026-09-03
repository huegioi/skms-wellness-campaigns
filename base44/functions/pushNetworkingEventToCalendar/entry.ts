import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { isTeamMember } from '../../shared/networkingEvents.ts';

// ---------------------------------------------------------------------------
// pushNetworkingEventToCalendar — puts a NetworkingEvent on the SkillfulMeans
// calendar so it sits beside client sessions. William's decision 2026-09-03:
// it goes on the SAME admin@skillfulmeans.life calendar the app already writes
// to (shared with William and Heather), not a separate one.
//
// Deliberately different from syncCalendarEventToGoogle: no Meet, no check-in
// link, no attendees — these are events we ATTEND, not ones we host. The
// description carries the organizer, the registration link and our own notes,
// and the entry is marked free/transparent so it doesn't block booking.
//
// Body: { event_id, action?: 'push' | 'remove' }
// ---------------------------------------------------------------------------

const CALENDAR_ID = 'admin%40skillfulmeans.life';
const GCAL = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const addDay = (ymd) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

function buildDescription(ev) {
  const lines = [];
  if (ev.org_name) lines.push(`<b>${esc(ev.org_name)}</b>`);
  if (ev.description) lines.push(esc(ev.description));
  if (ev.cost_text) lines.push(`Cost: ${esc(ev.cost_text)}`);
  if (ev.registration_url) lines.push(`<a href="${esc(ev.registration_url)}">Registration &amp; details</a>`);
  if (ev.opportunity && ev.opportunity !== 'none') lines.push(`Opportunity: ${esc(ev.opportunity)}`);
  if (ev.owner) lines.push(`Owner: ${esc(ev.owner)}`);
  if (ev.notes) lines.push(`Notes: ${esc(ev.notes)}`);
  lines.push('<i>Added from the SkillfulMeans networking calendar.</i>');
  return lines.join('<br>');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {}; try { body = await req.clone().json(); } catch (_) {}
    const isScheduled = !!body.automation;
    if (!isScheduled) {
      let user = null; try { user = await base44.auth.me(); } catch (_) {}
      if (!user || !isTeamMember(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { event_id, action = 'push' } = body;
    if (!event_id) return Response.json({ error: 'event_id required' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const rows = await db.NetworkingEvent.filter({ id: event_id });
    const ev = rows?.[0];
    if (!ev) return Response.json({ error: 'Event not found' }, { status: 404 });
    if (ev.is_demo) return Response.json({ success: true, skipped: true, reason: 'demo_record' });

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

    if (action === 'remove') {
      if (!ev.google_event_id) return Response.json({ success: true, removed: false });
      const res = await fetch(`${GCAL}/${ev.google_event_id}?sendUpdates=none`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok && res.status !== 404 && res.status !== 410) return Response.json({ error: `Google refused the delete (${res.status})` }, { status: 502 });
      await db.NetworkingEvent.update(ev.id, { google_event_id: '' });
      return Response.json({ success: true, removed: true });
    }

    const allDay = ev.all_day || isDateOnly(ev.start_date);
    const startDay = String(ev.start_date).slice(0, 10);
    const endDay = String(ev.end_date || ev.start_date).slice(0, 10);
    const payload = {
      summary: `${ev.org_name ? ev.org_name + ': ' : ''}${ev.title}`,
      description: buildDescription(ev),
      location: ev.format === 'virtual'
        ? (ev.registration_url || ev.venue || 'Virtual')
        : [ev.venue, [ev.city, ev.state].filter(Boolean).join(', ')].filter(Boolean).join(', '),
      // Networking events shouldn't make us look busy for client bookings.
      transparency: 'transparent',
      start: allDay ? { date: startDay } : { dateTime: ev.start_date, timeZone: ev.timezone || 'America/New_York' },
      // Google treats an all-day end date as exclusive.
      end: allDay ? { date: addDay(endDay) } : { dateTime: ev.end_date || ev.start_date, timeZone: ev.timezone || 'America/New_York' },
      extendedProperties: { private: { skms_networking_event_id: ev.id, skms_org_code: ev.org_code || '' } },
    };

    let googleEventId = ev.google_event_id || null;
    if (googleEventId) {
      const patch = await fetch(`${GCAL}/${googleEventId}?sendUpdates=none`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) });
      if (patch.status === 404 || patch.status === 410) googleEventId = null; // deleted in Google — recreate
      else if (!patch.ok) return Response.json({ error: `Failed to update the calendar event: ${await patch.text()}` }, { status: 502 });
    }
    if (!googleEventId) {
      const create = await fetch(`${GCAL}?sendUpdates=none`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
      if (!create.ok) return Response.json({ error: `Failed to create the calendar event: ${await create.text()}` }, { status: 502 });
      googleEventId = (await create.json()).id;
      await db.NetworkingEvent.update(ev.id, { google_event_id: googleEventId });
    }

    // Same eid encoding the app already uses elsewhere, so the link opens the event.
    const eid = btoa(`${googleEventId} admin@skillfulmeans.life`).replace(/=+$/, '');
    return Response.json({
      success: true,
      google_event_id: googleEventId,
      calendar: 'admin@skillfulmeans.life',
      html_link: `https://www.google.com/calendar/event?eid=${eid}`,
    });
  } catch (error) {
    console.error('pushNetworkingEventToCalendar error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
