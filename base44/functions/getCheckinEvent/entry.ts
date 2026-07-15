import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token } = body;
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const events = await base44.asServiceRole.entities.CalendarEvent.filter(
      { checkin_token: token, is_demo: false }
    );
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = events[0];

    // Resolve meeting link: explicit meeting_link, or location if it's a URL
    const location = (event.location || '').trim();
    const isUrl = /^https?:\/\//i.test(location);
    const meetingLink = event.meeting_link || (isUrl ? location : null);

    // Fetch client name for display
    let clientName = null;
    if (event.client_id) {
      try {
        const client = await base44.asServiceRole.entities.Client.get(event.client_id);
        clientName = client?.name || client?.company || null;
      } catch { clientName = null; }
    }

    return Response.json({
      event_id: event.id,
      title: event.title,
      start_date: event.start_date,
      client_name: clientName,
      has_meeting_link: !!meetingLink,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});