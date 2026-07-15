import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, name, email } = body;
    if (!token || !email) {
      return Response.json({ error: 'Token and email are required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Find event by token (exclude demo)
    const events = await base44.asServiceRole.entities.CalendarEvent.filter(
      { checkin_token: token, is_demo: false }
    );
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = events[0];

    // Rate limit: max 30 check-ins per event per minute
    const recentCheckins = await base44.asServiceRole.entities.EventCheckin.filter(
      { event_id: event.id }, '-checked_in_at', 30
    );
    const oneMinuteAgo = Date.now() - 60000;
    const recentCount = recentCheckins.filter(
      c => new Date(c.checked_in_at).getTime() > oneMinuteAgo
    ).length;
    if (recentCount >= 30) {
      return Response.json({ error: 'Too many check-ins. Please try again in a moment.' }, { status: 429 });
    }

    const now = new Date().toISOString();

    // Dedupe: same email + event updates rather than duplicates
    const existing = await base44.asServiceRole.entities.EventCheckin.filter(
      { event_id: event.id, email: normalizedEmail }
    );

    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.EventCheckin.update(existing[0].id, {
        name: name?.trim() || existing[0].name,
        checked_in_at: now,
      });
    } else {
      await base44.asServiceRole.entities.EventCheckin.create({
        event_id: event.id,
        name: name?.trim() || '',
        email: normalizedEmail,
        checked_in_at: now,
      });
    }

    // Resolve meeting link
    const location = (event.location || '').trim();
    const isUrl = /^https?:\/\//i.test(location);
    const meetingLink = event.meeting_link || (isUrl ? location : null);

    return Response.json({
      success: true,
      meeting_link: meetingLink || null,
      event_title: event.title,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});