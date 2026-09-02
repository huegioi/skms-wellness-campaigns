import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { portal_id, event_id, accepted, completed, decline_reason } = await req.json();

    if (!portal_id || !event_id) {
      return Response.json({ error: 'portal_id and event_id are required' }, { status: 400 });
    }

    // Verify the presenter owns this portal_id
    const presenters = await base44.asServiceRole.entities.Presenter.filter({ unique_portal_id: portal_id });
    if (!presenters || presenters.length === 0) {
      return Response.json({ error: 'Presenter not found' }, { status: 404 });
    }
    const presenter = presenters[0];

    // Fetch the event and verify it belongs to this presenter
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = events[0];

    if (event.presenter_id !== presenter.id) {
      return Response.json({ error: 'Forbidden: this event does not belong to your portal' }, { status: 403 });
    }

    const updates = {};
    if (accepted !== undefined) {
      if (accepted === true) {
        updates.presenter_accepted = true;
        updates.presenter_declined_at = null;
        updates.presenter_decline_reason = null;
      } else {
        // Decline: clear presenter assignment, flag for SchedulingHub
        updates.presenter_accepted = false;
        updates.presenter_declined_at = new Date().toISOString();
        if (decline_reason) {
          updates.presenter_decline_reason = decline_reason;
        }
        updates.presenter_id = null;
        updates.presenter_email = null;
        updates.presenter = null;
        // The seat is open again, so the notification stamp no longer applies — clearing
        // it lets the next presenter be notified from the event dialog.
        updates.presenter_notified_at = null;
        updates.presenter_notified_email = '';
        updates.presenter_notify_status = '';
        updates.presenter_notify_error = '';
      }
    }
    if (completed !== undefined) {
      // Server-side guard: reject completion of challenge events before end_date
      if (completed === true) {
        let isChallenge = event.event_type === 'challenge';
        if (!isChallenge && event.service_id) {
          const services = await base44.asServiceRole.entities.Service.filter({ id: event.service_id });
          if (services[0]?.category === 'challenge') isChallenge = true;
        }
        if (isChallenge && event.end_date) {
          const endDate = new Date(event.end_date);
          if (!isNaN(endDate.getTime()) && endDate > new Date()) {
            return Response.json({ error: 'Challenge facilitation cannot be marked complete before the end date.' }, { status: 400 });
          }
        }
      }
      updates.completed = completed;
      if (completed) updates.completed_date = new Date().toISOString();
    }

    const updated = await base44.asServiceRole.entities.CalendarEvent.update(event_id, updates);
    return Response.json({ success: true, event: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});