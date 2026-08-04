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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_id } = await req.json();
    if (!event_id) return Response.json({ error: 'event_id required' }, { status: 400 });

    const events = await base44.entities.CalendarEvent.filter({ id: event_id });
    const event = events[0];
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
    if (event.is_demo) return Response.json({ skipped: true, reason: 'demo event' });

    const results = [];
    const now = new Date();

    // (a) Workshop/class/leadership with check-ins running → queue post_session_pulse at end − 10 min
    if ((event.event_type === 'workshop' || event.event_type === 'class' || event.event_type === 'leadership') && event.start_date) {
      const checkins = await base44.entities.EventCheckin.filter({ event_id: event.id });
      const startTime = new Date(event.start_date);

      if (checkins.length > 0 && now >= startTime) {
        const existing = await base44.entities.ScheduledSurveySend.filter({
          event_id: event.id, send_type: 'post_session_pulse'
        });
        if (existing.filter(s => !s.is_demo).length === 0) {
          const computedSendAt = computePulseSendTime(event, startTime);
          // If already in the past (event already ended), set to now so the next
          // processing run picks it up rather than dropping it.
          const sendAt = computedSendAt > now ? computedSendAt : now;
          const send = await base44.entities.ScheduledSurveySend.create({
            send_type: 'post_session_pulse',
            event_id: event.id,
            client_id: event.client_id || undefined,
            service_id: event.service_id || undefined,
            send_at: sendAt.toISOString(),
            status: 'pending'
          });
          results.push({ type: 'post_session_pulse', send_id: send.id, send_at: sendAt.toISOString() });
        }
      }
    }

    // (b)+(c) Endpoint event completed → queue cohort_end (next morning) + cohort_1mo (+30 days)
    if (event.completed && event.assessment_timing === 'endpoint') {
      const clientId = event.client_id;
      const serviceId = event.service_id;

      if (clientId && serviceId) {
        // cohort_end
        const existingEnd = await base44.entities.ScheduledSurveySend.filter({
          event_id: event.id, send_type: 'cohort_end'
        });
        if (existingEnd.filter(s => !s.is_demo).length === 0) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          const send = await base44.entities.ScheduledSurveySend.create({
            send_type: 'cohort_end',
            event_id: event.id,
            client_id: clientId,
            service_id: serviceId,
            proposal_id: event.proposal_id || undefined,
            send_at: tomorrow.toISOString(),
            status: 'pending'
          });
          results.push({ type: 'cohort_end', send_id: send.id, send_at: tomorrow.toISOString() });
        }

        // cohort_1mo (+30 days)
        const existing1mo = await base44.entities.ScheduledSurveySend.filter({
          event_id: event.id, send_type: 'cohort_1mo'
        });
        if (existing1mo.filter(s => !s.is_demo).length === 0) {
          const sendAt = new Date();
          sendAt.setDate(sendAt.getDate() + 30);
          sendAt.setHours(9, 0, 0, 0);
          const send = await base44.entities.ScheduledSurveySend.create({
            send_type: 'cohort_1mo',
            event_id: event.id,
            client_id: clientId,
            service_id: serviceId,
            proposal_id: event.proposal_id || undefined,
            send_at: sendAt.toISOString(),
            status: 'pending'
          });
          results.push({ type: 'cohort_1mo', send_id: send.id, send_at: sendAt.toISOString() });
        }
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});