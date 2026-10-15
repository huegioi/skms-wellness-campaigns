import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Base44's hosted database occasionally times out a write ("Write results
// unavailable ... Request timed out"). These are transient — the same write
// succeeds seconds later — so we retry instead of failing the attendee.
const isTransient = (err: unknown) =>
  /timed? ?out|timeout|write results unavailable|ECONNRESET|socket|network|NotWritablePrimary|PrimarySteppedDown|InterruptedDueToReplStateChange|\b50[234]\b/i
    .test(String((err as any)?.message || err || ''));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const FRIENDLY_SAVE_ERROR = "We couldn't save your check-in just now. Please tap Try again.";

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

    // Rate limit: max 150 check-ins per event per minute. Kept as an abuse guard,
    // but sized for real workshop load (60–100 people can scan the QR at the top
    // of the hour). The frontend retries on 429 so genuine attendees are never
    // locked out of the meeting link.
    const recentCheckins = await base44.asServiceRole.entities.EventCheckin.filter(
      { event_id: event.id }, '-checked_in_at', 150
    );
    const oneMinuteAgo = Date.now() - 60000;
    const recentCount = recentCheckins.filter(
      c => new Date(c.checked_in_at).getTime() > oneMinuteAgo
    ).length;
    if (recentCount >= 150) {
      return Response.json({ error: 'Too many check-ins. Please try again in a moment.' }, { status: 429 });
    }

    const now = new Date().toISOString();

    // ALWAYS create a new check-in record — every submission is its own row.
    // The same email can check into many events and multiple times to the
    // same event. No upsert, no dedup at write time.
    // client_id is copied from the event for direct portal grouping; null if
    // the event has no client (becomes an "unmatched" check-in).
    const record = {
      event_id: event.id,
      client_id: event.client_id || null,
      name: name?.trim() || '',
      email: normalizedEmail,
      checked_in_at: now,
    };
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      try {
        await base44.asServiceRole.entities.EventCheckin.create(record);
        saved = true;
      } catch (err) {
        console.error(`submitCheckin: create failed (attempt ${attempt + 1})`, (err as any)?.message);
        if (!isTransient(err)) throw err;
        await sleep(700 * (attempt + 1));
        // "Write results unavailable" can mean the write actually landed —
        // look for this exact row before writing it again.
        try {
          const existing = await base44.asServiceRole.entities.EventCheckin.filter(
            { event_id: event.id, email: normalizedEmail }, '-checked_in_at', 3
          );
          if ((existing || []).some((c: any) => c.checked_in_at === now)) saved = true;
        } catch { /* fall through to retry */ }
      }
    }
    if (!saved) {
      return Response.json({ error: FRIENDLY_SAVE_ERROR, retryable: true }, { status: 503 });
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
    // Never show raw database/infrastructure errors to attendees.
    console.error('submitCheckin: unhandled error', (error as any)?.message);
    return Response.json(
      { error: FRIENDLY_SAVE_ERROR, retryable: isTransient(error) },
      { status: isTransient(error) ? 503 : 500 }
    );
  }
});