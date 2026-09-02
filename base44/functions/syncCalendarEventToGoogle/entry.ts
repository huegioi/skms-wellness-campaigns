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
const GCAL = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;

// ── Google Meet lives on a SEPARATE private "holder" event ─────────────────────
// A Meet attached to the client-facing event is always visible to invitees (Google
// renders the "Join with Google Meet" button on it), which would put two links in
// front of attendees. So the client event carries ONLY the check-in link, and the
// Meet room is created on a private, non-blocking holder event with no attendees.
// The app stores the room URL on CalendarEvent.meeting_link and hands it out after
// check-in. Google only creates a Meet when the request carries a createRequest AND
// the URL has conferenceDataVersion=1. requestId is stable per event so a retry
// never spawns a second room.
function meetCreateRequest(event) {
  return {
    createRequest: {
      requestId: `skms-meet-${event.id}`,
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  };
}
function extractMeetLink(gEvent) {
  return gEvent?.hangoutLink
    || gEvent?.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
    || '';
}
// The assigned presenter is the ONE attendee the holder ever carries. Being an invitee
// on the event that owns the Meet is what lets a presenter outside our domain join
// without knocking (same-domain presenters already could). sendUpdates=none on every
// call means Google emails nobody — notifyPresenterAssignment is what tells them.
function holderAttendees(event) {
  const email = (event.presenter_email || '').trim();
  return email ? [{ email, responseStatus: 'needsAction' }] : [];
}
function holderBody(event, eventData) {
  const attendees = holderAttendees(event);
  const hasPresenter = attendees.length > 0;
  return {
    // With a presenter invited the holder lands on THEIR calendar too, so it has to
    // read as the session rather than as our internal plumbing.
    summary: hasPresenter ? `Presenting · ${event.title}` : `Meet room · ${event.title}`,
    description: hasPresenter
      ? `You're presenting this SkillfulMeans session. Join with the Google Meet link on this event.\n\nAttendees join separately after they check in, so they may arrive a few minutes after the start time.\n\nHolds the Google Meet room for this session — the client-facing invite is a separate event carrying only the check-in link.`
      : 'Holds the Google Meet room for this SkillfulMeans session. Attendees receive the link automatically after they check in. Do not invite attendees to this event — the client-facing invite is the separate event with the check-in link.',
    start: eventData.start,
    end: eventData.end,
    visibility: 'private',
    // Block the presenter's time when one is assigned; stay free/transparent otherwise.
    transparency: hasPresenter ? 'opaque' : 'transparent',
    attendees,
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: false,
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: { skms_event_id: event.id, skms_role: 'meet_holder' } },
  };
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
    const authHeaders = { 'Authorization': `Bearer ${accessToken}` };
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };
    const gcalDelete = async (gid) => {
      if (!gid) return true;
      const res = await fetch(`${GCAL}/${gid}?sendUpdates=none`, { method: 'DELETE', headers: authHeaders });
      return res.ok || res.status === 404 || res.status === 410;
    };

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
      // Client-facing event: title, check-in link, description, times. NEVER a Meet.
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
      let strippedInviteMeet = false;

      if (googleEventId) {
        // If a Meet was attached to the client event (added by hand, or by an older
        // version of this sync), strip it so invitees only ever see the check-in link.
        let hasInviteMeet = false;
        const getRes = await fetch(`${GCAL}/${googleEventId}`, { headers: authHeaders });
        if (getRes.ok) {
          hasInviteMeet = !!extractMeetLink(await getRes.json());
        } else if (getRes.status === 404 || getRes.status === 410) {
          googleEventId = null; // deleted in Google — recreate below
        }
        if (googleEventId) {
          // PATCH — not PUT — to preserve attendees, reminders, extendedProperties, colorId.
          const patchBody = hasInviteMeet ? { ...eventData, conferenceData: null } : eventData;
          const updateResponse = await fetch(
            `${GCAL}/${googleEventId}?sendUpdates=none${hasInviteMeet ? '&conferenceDataVersion=1' : ''}`,
            { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patchBody) }
          );
          if (!updateResponse.ok) {
            const error = await updateResponse.text();
            throw new Error(`Failed to update Google Calendar event: ${error}`);
          }
          strippedInviteMeet = hasInviteMeet;
        }
      }

      if (!googleEventId) {
        const createResponse = await fetch(`${GCAL}?sendUpdates=none`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            ...eventData,
            extendedProperties: { private: { skms_event_id: event.id, skms_event_type: event.event_type || '' } },
          })
        });
        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create Google Calendar event: ${error}`);
        }
        const result = await createResponse.json();
        googleEventId = result.id;
      }

      // ── Meet holder event ──
      let meetEventId = event.google_meet_event_id || null;
      let meetLink = '';
      if (meetEventId) {
        const getRes = await fetch(`${GCAL}/${meetEventId}`, { headers: authHeaders });
        if (getRes.ok) {
          const holder = await getRes.json();
          if (holder.status === 'cancelled') {
            meetEventId = null;
          } else {
            meetLink = extractMeetLink(holder);
            // Keep the holder on the session's time; add a room if it somehow lacks one.
            const needsMeet = !meetLink;
            const patchRes = await fetch(
              `${GCAL}/${meetEventId}?sendUpdates=none${needsMeet ? '&conferenceDataVersion=1' : ''}`,
              {
                method: 'PATCH', headers: jsonHeaders,
                body: JSON.stringify({
                  // Re-send the whole holder body so a presenter added, swapped or
                  // removed since the last sync propagates (PATCH replaces attendees).
                  ...holderBody(event, eventData),
                  ...(needsMeet ? { conferenceData: meetCreateRequest(event) } : {}),
                })
              }
            );
            if (patchRes.ok) meetLink = extractMeetLink(await patchRes.json()) || meetLink;
          }
        } else if (getRes.status === 404 || getRes.status === 410) {
          meetEventId = null;
        }
      }
      // A hand-chosen Zoom/Teams link means no Meet room is wanted — don't create a holder.
      const usesOtherProvider = !!event.meeting_link && !/meet\.google\.com/i.test(event.meeting_link);
      if (!meetEventId && !usesOtherProvider) {
        const holderRes = await fetch(`${GCAL}?sendUpdates=none&conferenceDataVersion=1`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ ...holderBody(event, eventData), conferenceData: meetCreateRequest(event) })
        });
        if (!holderRes.ok) {
          const error = await holderRes.text();
          console.error('Meet holder create failed:', error);
        } else {
          const holder = await holderRes.json();
          meetEventId = holder.id;
          meetLink = extractMeetLink(holder);
        }
      }
      // Meet creation is async on Google's side — if the link isn't back yet, re-read once.
      if (meetEventId && !meetLink) {
        const again = await fetch(`${GCAL}/${meetEventId}`, { headers: authHeaders });
        if (again.ok) meetLink = extractMeetLink(await again.json());
      }

      // Persist ids + meeting_link (the check-in page hands meeting_link to attendees).
      const patch = {};
      if (googleEventId !== event.google_event_id) patch.google_event_id = googleEventId;
      if (meetEventId !== (event.google_meet_event_id || null)) patch.google_meet_event_id = meetEventId;
      // Only fill/refresh meeting_link when it's empty or already a Meet URL — a Zoom/Teams
      // link William pasted by hand must survive a re-sync.
      const existing = event.meeting_link || '';
      const existingIsMeet = /meet\.google\.com/i.test(existing);
      if (meetLink && meetLink !== existing && (!existing || existingIsMeet)) patch.meeting_link = meetLink;
      if (Object.keys(patch).length) {
        await base44.asServiceRole.entities.CalendarEvent.update(eventId, patch);
      }

      return Response.json({
        success: true,
        googleEventId,
        meetEventId,
        meetLink: meetLink || null,
        // Who, if anyone, was invited to the room — the event dialog shows this back.
        presenterInvited: meetEventId ? (holderAttendees(event)[0]?.email || null) : null,
        strippedInviteMeet,
        message: meetLink
          ? 'Event synced to Google Calendar; Meet room ready (kept off the invite)'
          : 'Event synced to Google Calendar (no Meet link returned)'
      });

    } else if (action === 'unsync') {
      // Remove client event AND the Meet holder from Google Calendar
      if (event.google_event_id && !(await gcalDelete(event.google_event_id))) {
        throw new Error('Failed to delete Google Calendar event');
      }
      await gcalDelete(event.google_meet_event_id);
      if (event.google_event_id || event.google_meet_event_id) {
        // Drop the Meet room link with the Google event; keep a hand-pasted Zoom/Teams link.
        const keepLink = event.meeting_link && !/meet\.google\.com/i.test(event.meeting_link);
        await base44.asServiceRole.entities.CalendarEvent.update(eventId, {
          google_event_id: null,
          google_meet_event_id: null,
          ...(keepLink ? {} : { meeting_link: null })
        });
      }

      return Response.json({
        success: true,
        message: 'Event removed from Google Calendar'
      });

    } else if (action === 'delete') {
      await gcalDelete(event.google_event_id);
      await gcalDelete(event.google_meet_event_id);
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
