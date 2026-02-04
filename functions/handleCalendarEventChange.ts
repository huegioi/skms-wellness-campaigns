import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    // Only proceed if event has google_event_id (is synced)
    if (!data?.google_event_id && !old_data?.google_event_id) {
      return Response.json({ success: true, message: 'Event not synced, skipping' });
    }

    // Get access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    if (event.type === 'delete') {
      // Delete from Google Calendar
      if (old_data?.google_event_id) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${old_data.google_event_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
      }
      return Response.json({ success: true, message: 'Deleted from Google Calendar' });
    }

    if (event.type === 'update' && data.google_event_id) {
      // Update Google Calendar event
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

      const updateResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${data.google_event_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventData)
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        console.error('Failed to update Google Calendar:', error);
        return Response.json({ 
          success: false, 
          error: `Failed to update Google Calendar: ${error}` 
        }, { status: 500 });
      }

      return Response.json({ success: true, message: 'Updated in Google Calendar' });
    }

    return Response.json({ success: true, message: 'No action needed' });

  } catch (error) {
    console.error('Calendar sync error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});