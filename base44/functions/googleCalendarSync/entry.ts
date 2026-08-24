import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

// ── Inline email-domain helpers (can't import from ../../shared/ in Deno) ──
const EXCLUDED_DOMAINS = new Set([
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'skillfulmeans.life',
]);

function extractEmailDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const atIdx = email.indexOf('@');
  if (atIdx === -1) return null;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  return domain || null;
}

function isExcludedDomain(domain) {
  if (!domain) return true;
  return EXCLUDED_DOMAINS.has(domain);
}

// Build domain → client index (only unambiguous domains map to a single client).
function buildClientDomainIndex(clients) {
  const domainToClients = new Map();
  const trackDomain = (domain, client) => {
    const d = String(domain).toLowerCase().trim();
    if (!d || EXCLUDED_DOMAINS.has(d)) return;
    if (!domainToClients.has(d)) domainToClients.set(d, []);
    domainToClients.get(d).push(client);
  };
  for (const c of clients) {
    const domain = c.email_domain || extractEmailDomain(c.email);
    if (domain) trackDomain(domain, c);
    for (const alias of (c.email_domain_aliases || [])) trackDomain(alias, c);
  }
  const domainToClient = new Map();
  for (const [domain, list] of domainToClients) {
    const unique = list.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    if (unique.length === 1) domainToClient.set(domain, unique[0]);
  }
  return domainToClient;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, eventData, calendarId } = await req.json();
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlecalendar");

    if (action === 'listCalendars') {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      return Response.json({ calendars: data.items || [] });
    }

    if (action === 'createEvent') {
      // Demo events never sync to Google Calendar — they're test data.
      if (eventData?.is_demo) {
        return Response.json({ success: false, skipped: 'demo event' });
      }
      const checkinUrl = buildCheckinUrl(eventData.checkin_token);
      const googleEvent = {
        summary: eventData.title,
        description: eventData.checkin_token ? buildInviteDescription(eventData, null) : (eventData.description || ''),
        location: eventData.checkin_token ? (checkinUrl || '') : (eventData.location || ''),
        start: eventData.all_day 
          ? { date: eventData.start_date.split('T')[0] }
          : { dateTime: eventData.start_date, timeZone: 'America/New_York' },
        end: eventData.all_day
          ? { date: (eventData.end_date || eventData.start_date).split('T')[0] }
          : { dateTime: eventData.end_date || eventData.start_date, timeZone: 'America/New_York' },
        extendedProperties: {
          private: {
            skms_event_id: eventData.id || '',
            skms_event_type: eventData.event_type || ''
          }
        }
        // NO conferenceData here: a Meet on the client-facing event is visible to every
        // invitee. The Meet room lives on a separate private holder event (below).
      };

      const targetCalendar = calendarId || 'primary';
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events?sendUpdates=none`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEvent)
      });
      
      const result = await response.json();

      // Meet holder: private, non-blocking, no attendees. Attendees get the room link
      // from the check-in page, never from the invite. Same pattern as syncCalendarEventToGoogle.
      let meetLink = null;
      let meetEventId = null;
      if (eventData.id && !eventData.all_day) {
        try {
          const holderRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events?sendUpdates=none&conferenceDataVersion=1`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: `Meet room · ${eventData.title}`,
              description: 'Holds the Google Meet room for this SkillfulMeans session. Attendees receive the link automatically after they check in. Do not invite attendees to this event.',
              start: googleEvent.start,
              end: googleEvent.end,
              visibility: 'private',
              transparency: 'transparent',
              reminders: { useDefault: false, overrides: [] },
              extendedProperties: { private: { skms_event_id: eventData.id, skms_role: 'meet_holder' } },
              conferenceData: {
                createRequest: {
                  requestId: `skms-meet-${eventData.id}`,
                  conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
              },
            })
          });
          if (holderRes.ok) {
            const holder = await holderRes.json();
            meetEventId = holder.id;
            meetLink = holder.hangoutLink
              || holder.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
              || null;
          } else {
            console.error('Meet holder create failed:', await holderRes.text());
          }
        } catch (e) {
          console.error('Meet holder create failed:', e);
        }
      }
      return Response.json({ success: true, googleEventId: result.id, meetEventId, meetLink, event: result });
    }

    if (action === 'updateEvent') {
      const { googleEventId } = eventData;
      const checkinUrl = buildCheckinUrl(eventData.checkin_token);
      const googleEvent = {
        summary: eventData.title,
        description: eventData.checkin_token ? buildInviteDescription(eventData, null) : (eventData.description || ''),
        location: eventData.checkin_token ? (checkinUrl || '') : (eventData.location || ''),
        start: eventData.all_day 
          ? { date: eventData.start_date.split('T')[0] }
          : { dateTime: eventData.start_date, timeZone: 'America/New_York' },
        end: eventData.all_day
          ? { date: (eventData.end_date || eventData.start_date).split('T')[0] }
          : { dateTime: eventData.end_date || eventData.start_date, timeZone: 'America/New_York' }
      };

      const targetCalendar = calendarId || 'primary';
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${googleEventId}?sendUpdates=none`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEvent)
      });
      
      const result = await response.json();
      return Response.json({ success: true, event: result });
    }

    if (action === 'deleteEvent') {
      const { googleEventId } = eventData;
      const targetCalendar = calendarId || 'primary';
      
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${googleEventId}?sendUpdates=none`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      return Response.json({ success: true });
    }

    if (action === 'fetchEvents') {
      const targetCalendar = calendarId || 'primary';
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);

      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events`);
      url.searchParams.set('timeMin', timeMin.toISOString());
      url.searchParams.set('timeMax', timeMax.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      return Response.json({ events: data.items || [] });
    }

    if (action === 'syncFromGoogle') {
      const targetCalendar = calendarId || 'primary';
      const keywords = eventData?.keywords || [];
      
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1);
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);

      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events`);
      url.searchParams.set('timeMin', timeMin.toISOString());
      url.searchParams.set('timeMax', timeMax.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      const googleEvents = data.items || [];
      
      // Get existing events to avoid duplicates
      const existingEvents = await base44.entities.CalendarEvent.filter({});
      const existingGoogleIds = new Set(existingEvents.filter(e => e.google_event_id).map(e => e.google_event_id));
      
      // Load entities for attendee matching
      const [partners, clients, leads] = await Promise.all([
        base44.entities.ReferralPartner.list(),
        base44.entities.Client.list(),
        base44.entities.Lead.filter({ is_archived: { $ne: true } }),
      ]);

      // Exact-email indexes (include email2 where present)
      const partnerByEmail = new Map();
      for (const p of partners) {
        if (p.email) partnerByEmail.set(p.email.toLowerCase().trim(), p);
        if (p.email2) partnerByEmail.set(p.email2.toLowerCase().trim(), p);
      }
      const clientByEmail = new Map();
      for (const c of clients) {
        if (c.email) clientByEmail.set(c.email.toLowerCase().trim(), c);
        if (c.email2) clientByEmail.set(c.email2.toLowerCase().trim(), c);
      }
      const leadByEmail = new Map();
      for (const l of leads) {
        if (l.email) leadByEmail.set(l.email.toLowerCase().trim(), l);
        if (l.email2) leadByEmail.set(l.email2.toLowerCase().trim(), l);
      }

      // Domain index for clients (only unambiguous domains → single client)
      const domainToClient = buildClientDomainIndex(clients);

      const importedEvents = [];
      let matchedPartner = 0, matchedClientEmail = 0, matchedLead = 0, matchedClientDomain = 0, unlinked = 0;
      
      for (const gEvent of googleEvents) {
        // Skip if already imported
        if (existingGoogleIds.has(gEvent.id)) continue;
        
        // Skip if from our app (has skms_event_id)
        if (gEvent.extendedProperties?.private?.skms_event_id) continue;
        
        // Filter by keywords if specified
        if (keywords.length > 0) {
          const title = (gEvent.summary || '').toLowerCase();
          const hasKeyword = keywords.some(kw => title.includes(kw.toLowerCase()));
          if (!hasKeyword) continue;
        }
        
        const isAllDay = !!gEvent.start.date;
        const startDate = isAllDay ? gEvent.start.date + 'T00:00:00' : gEvent.start.dateTime;
        const endDate = isAllDay ? gEvent.end.date + 'T23:59:59' : gEvent.end.dateTime;

        // Extract attendees — skip organizer's own address and resource rooms
        const organizerEmail = gEvent.organizer?.email?.toLowerCase().trim() || '';
        const attendeeEmails = (gEvent.attendees || [])
          .map(a => a.email?.toLowerCase().trim())
          .filter(e => e && !e.endsWith('@resource.calendar.google.com') && e !== organizerEmail);

        // Attendee matching: exact email → partner, client, lead (first match wins)
        let referral_partner_id = null;
        let client_id = null;
        let lead_id = null;
        let matchMethod = 'unlinked';

        for (const email of attendeeEmails) {
          if (partnerByEmail.has(email)) { referral_partner_id = partnerByEmail.get(email).id; matchMethod = 'partner_email'; break; }
        }
        if (matchMethod === 'unlinked') {
          for (const email of attendeeEmails) {
            if (clientByEmail.has(email)) { client_id = clientByEmail.get(email).id; matchMethod = 'client_email'; break; }
          }
        }
        if (matchMethod === 'unlinked') {
          for (const email of attendeeEmails) {
            if (leadByEmail.has(email)) { lead_id = leadByEmail.get(email).id; matchMethod = 'lead_email'; break; }
          }
        }

        // Domain match against Client (only if no exact match, only unambiguous domains)
        if (matchMethod === 'unlinked') {
          for (const email of attendeeEmails) {
            const domain = extractEmailDomain(email);
            if (domain && !isExcludedDomain(domain) && domainToClient.has(domain)) {
              client_id = domainToClient.get(domain).id;
              matchMethod = 'client_domain';
              break;
            }
          }
        }

        if (matchMethod === 'partner_email') matchedPartner++;
        else if (matchMethod === 'client_email') matchedClientEmail++;
        else if (matchMethod === 'lead_email') matchedLead++;
        else if (matchMethod === 'client_domain') matchedClientDomain++;
        else unlinked++;

        // Meet link: hangoutLink → conferenceData video entryPoint. Stored on meeting_link only;
        // location holds the Google event's own location field so invites point at the check-in page.
        const videoLink = gEvent.hangoutLink
          || gEvent.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
          || '';
        const location = gEvent.location || '';
        const eventType = attendeeEmails.length > 0 ? 'meeting' : 'other';
        
        const newEvent = await base44.entities.CalendarEvent.create({
          title: gEvent.summary || 'Untitled',
          description: gEvent.description || '',
          location,
          meeting_link: videoLink || undefined,
          start_date: startDate,
          end_date: endDate,
          all_day: isAllDay,
          event_type: eventType,
          google_event_id: gEvent.id,
          checkin_token: crypto.randomUUID(),
          color: '#013f7c',
          referral_partner_id: referral_partner_id || undefined,
          client_id: client_id || undefined,
          lead_id: lead_id || undefined,
        });
        
        importedEvents.push(newEvent);
      }
      
      return Response.json({ 
        success: true, 
        imported: importedEvents.length, 
        events: importedEvents,
        match_report: {
          total_processed: importedEvents.length,
          matched_partner: matchedPartner,
          matched_client_email: matchedClientEmail,
          matched_lead: matchedLead,
          matched_client_domain: matchedClientDomain,
          unlinked,
        },
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});