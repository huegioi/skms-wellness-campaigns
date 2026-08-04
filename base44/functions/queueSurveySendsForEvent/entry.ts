import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Compute pulse send time: end − 10 min, floored to start + 15 min.
// Fallback: start + typical duration (60 min) − 10 min when no end_date.
const ENPS_FLOOR_MIN = 15;
const ENPS_OFFSET_MIN = 10;
const ENPS_TYPICAL_DURATION_MIN = 60;

function computePulseSendTime(event, startTime) {
  const floor = new Date(startTime.getTime() + ENPS_FLOOR_MIN * 60 * 1000);
  if (event.end_date) {
    const candidate = new Date(new Date(event.end_date).getTime() - ENPS_OFFSET_MIN * 60 * 1000);
    return candidate < floor ? floor : candidate;
  }
  const fallback = new Date(startTime.getTime() + (ENPS_TYPICAL_DURATION_MIN - ENPS_OFFSET_MIN) * 60 * 1000);
  return fallback < floor ? floor : fallback;
}

// Per-event queueing logic — shared by single-event and sweep modes.
// Runs as the service role so it works in a scheduled (non-interactive) context.
// The existing dedup guards (existing-send checks) make repeated calls idempotent.
async function processEvent(base44, event) {
  const results = [];
  const queued = { post_session_pulse: 0, cohort_end: 0, cohort_1mo: 0 };
  const skipped = [];
  const now = new Date();

  if (event.is_demo) {
    skipped.push({ reason: 'demo event' });
    return { results, queued, skipped };
  }

  // (a) Workshop/class/leadership with check-ins running → queue post_session_pulse at end − 10 min
  if ((event.event_type === 'workshop' || event.event_type === 'class' || event.event_type === 'leadership') && event.start_date) {
    const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: event.id });
    const startTime = new Date(event.start_date);

    if (checkins.length > 0 && now >= startTime) {
      const existing = await base44.asServiceRole.entities.ScheduledSurveySend.filter({
        event_id: event.id, send_type: 'post_session_pulse'
      });
      if (existing.filter(s => !s.is_demo).length === 0) {
        const computedSendAt = computePulseSendTime(event, startTime);
        // If already in the past (event already ended), set to now so the next
        // processing run picks it up rather than dropping it.
        const sendAt = computedSendAt > now ? computedSendAt : now;
        const send = await base44.asServiceRole.entities.ScheduledSurveySend.create({
          send_type: 'post_session_pulse',
          event_id: event.id,
          client_id: event.client_id || undefined,
          service_id: event.service_id || undefined,
          send_at: sendAt.toISOString(),
          status: 'pending'
        });
        results.push({ type: 'post_session_pulse', send_id: send.id, send_at: sendAt.toISOString() });
        queued.post_session_pulse++;
      } else {
        skipped.push({ type: 'post_session_pulse', reason: 'already queued' });
      }
    } else {
      skipped.push({ type: 'post_session_pulse', reason: 'no checkins or not started' });
    }
  }

  // (b)+(c) Endpoint event completed → queue cohort_end (next morning) + cohort_1mo (+30 days)
  if (event.completed && event.assessment_timing === 'endpoint') {
    const clientId = event.client_id;
    const serviceId = event.service_id;

    if (clientId && serviceId) {
      // cohort_end
      const existingEnd = await base44.asServiceRole.entities.ScheduledSurveySend.filter({
        event_id: event.id, send_type: 'cohort_end'
      });
      if (existingEnd.filter(s => !s.is_demo).length === 0) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const send = await base44.asServiceRole.entities.ScheduledSurveySend.create({
          send_type: 'cohort_end',
          event_id: event.id,
          client_id: clientId,
          service_id: serviceId,
          proposal_id: event.proposal_id || undefined,
          send_at: tomorrow.toISOString(),
          status: 'pending'
        });
        results.push({ type: 'cohort_end', send_id: send.id, send_at: tomorrow.toISOString() });
        queued.cohort_end++;
      } else {
        skipped.push({ type: 'cohort_end', reason: 'already queued' });
      }

      // cohort_1mo (+30 days)
      const existing1mo = await base44.asServiceRole.entities.ScheduledSurveySend.filter({
        event_id: event.id, send_type: 'cohort_1mo'
      });
      if (existing1mo.filter(s => !s.is_demo).length === 0) {
        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + 30);
        sendAt.setHours(9, 0, 0, 0);
        const send = await base44.asServiceRole.entities.ScheduledSurveySend.create({
          send_type: 'cohort_1mo',
          event_id: event.id,
          client_id: clientId,
          service_id: serviceId,
          proposal_id: event.proposal_id || undefined,
          send_at: sendAt.toISOString(),
          status: 'pending'
        });
        results.push({ type: 'cohort_1mo', send_id: send.id, send_at: sendAt.toISOString() });
        queued.cohort_1mo++;
      } else {
        skipped.push({ type: 'cohort_1mo', reason: 'already queued' });
      }
    } else {
      skipped.push({ type: 'cohort_end/1mo', reason: 'missing client_id or service_id' });
    }
  }

  return { results, queued, skipped };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { event_id, sweep } = body;

    // ── Single-event mode (original behavior) ──
    if (!sweep && event_id) {
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
      const event = events[0];
      if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
      const { results, queued, skipped } = await processEvent(base44, event);
      return Response.json({ success: true, results, queued, skipped });
    }

    // ── Sweep mode: find candidate events from the last 7 days and queue sends.
    // Driven by a scheduled automation. The per-event dedup guards make this idempotent,
    // so running every 30 minutes is safe.
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent non-demo events, newest first, capped at 200 per run.
    const recentEvents = await base44.asServiceRole.entities.CalendarEvent.filter(
      { is_demo: false }, '-start_date', 200
    );

    // Filter to past events within the last 7 days that match either pulse or
    // endpoint criteria.
    const candidates = recentEvents.filter(e => {
      if (!e.start_date) return false;
      const start = new Date(e.start_date);
      if (start > now) return false;          // future events only — skip
      if (start < sevenDaysAgo) return false; // beyond 7-day window
      const isPulseCandidate =
        e.event_type === 'workshop' || e.event_type === 'class' || e.event_type === 'leadership';
      const isEndpointCandidate =
        e.completed === true && e.assessment_timing === 'endpoint';
      return isPulseCandidate || isEndpointCandidate;
    });

    let scanned = 0;
    const queued = { post_session_pulse: 0, cohort_end: 0, cohort_1mo: 0 };
    const allResults = [];
    let skippedCount = 0;

    for (const event of candidates) {
      scanned++;
      const { results, queued: q, skipped } = await processEvent(base44, event);
      allResults.push(...results);
      skippedCount += skipped.length;
      queued.post_session_pulse += q.post_session_pulse;
      queued.cohort_end += q.cohort_end;
      queued.cohort_1mo += q.cohort_1mo;
    }

    return Response.json({
      success: true,
      sweep: true,
      events_scanned: scanned,
      sends_queued: queued,
      skipped: skippedCount,
      results: allResults,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});