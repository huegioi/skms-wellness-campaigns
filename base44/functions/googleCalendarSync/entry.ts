import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
      const googleEvent = {
        summary: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
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
      };

      const targetCalendar = calendarId || 'primary';
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEvent)
      });
      
      const result = await response.json();
      return Response.json({ success: true, googleEventId: result.id, event: result });
    }

    if (action === 'updateEvent') {
      const { googleEventId } = eventData;
      const googleEvent = {
        summary: eventData.title,
        description: eventData.description || '',
        location: eventData.location || '',
        start: eventData.all_day 
          ? { date: eventData.start_date.split('T')[0] }
          : { dateTime: eventData.start_date, timeZone: 'America/New_York' },
        end: eventData.all_day
          ? { date: (eventData.end_date || eventData.start_date).split('T')[0] }
          : { dateTime: eventData.end_date || eventData.start_date, timeZone: 'America/New_York' }
      };

      const targetCalendar = calendarId || 'primary';
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${googleEventId}`, {
        method: 'PUT',
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
      
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${googleEventId}`, {
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
      
      const importedEvents = [];
      
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
        
        const newEvent = await base44.entities.CalendarEvent.create({
          title: gEvent.summary || 'Untitled',
          description: gEvent.description || '',
          location: gEvent.location || '',
          start_date: startDate,
          end_date: endDate,
          all_day: isAllDay,
          event_type: 'other',
          google_event_id: gEvent.id,
          color: '#013f7c'
        });
        
        importedEvents.push(newEvent);
      }
      
      return Response.json({ success: true, imported: importedEvents.length, events: importedEvents });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});