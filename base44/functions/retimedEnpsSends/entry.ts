import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Same timing constants as queueSurveySendsForEvent
const ENPS_FLOOR_MIN = 15;
const ENPS_OFFSET_MIN = 10;
const ENPS_TYPICAL_DURATION_MIN = 60;

function computeEnpsSendTime(event, startTime) {
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

    const now = new Date();
    const allPending = await base44.entities.ScheduledSurveySend.filter({
      send_type: 'enps_post_session', status: 'pending'
    }, '-send_at', 200);

    let retimed = 0;
    let skipped = 0;
    const details = [];

    for (const send of allPending) {
      if (send.is_demo) { skipped++; continue; }
      if (!send.event_id) { skipped++; continue; }

      // Don't touch sends already in the past (about to fire or being processed)
      if (new Date(send.send_at) <= now) { skipped++; continue; }

      const events = await base44.entities.CalendarEvent.filter({ id: send.event_id });
      const event = events[0];
      if (!event) { skipped++; continue; }

      // Don't touch events that already ended
      if (event.end_date && new Date(event.end_date) <= now) { skipped++; continue; }
      if (!event.start_date) { skipped++; continue; }

      const startTime = new Date(event.start_date);
      const newSendAt = computeEnpsSendTime(event, startTime);
      const oldSendAt = new Date(send.send_at);

      // Only update if the new time differs by more than 1 minute
      if (Math.abs(newSendAt.getTime() - oldSendAt.getTime()) > 60 * 1000) {
        await base44.entities.ScheduledSurveySend.update(send.id, {
          send_at: newSendAt.toISOString()
        });
        retimed++;
        details.push({
          send_id: send.id,
          event_id: event.id,
          event_title: event.title,
          old: oldSendAt.toISOString(),
          new: newSendAt.toISOString()
        });
      } else {
        skipped++;
      }
    }

    return Response.json({ success: true, retimed, skipped, details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});