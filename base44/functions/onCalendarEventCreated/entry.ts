import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Exact task descriptions from taskTemplates.jsx / createTasksOnProposal
const EVENT_SCHEDULING_TASK = 'Event Scheduling: Finalize dates for ideation calls, workshops, and challenges';
const CHALLENGE_APP_TASK = '[CHALLENGE] SETUP — Challenge added to the SkillfulMeans app with event details';

async function completeTask(base44, filter, sourceEvent) {
  const tasks = await base44.asServiceRole.entities.ClientTask.filter(filter);
  const pending = tasks.find(t => t.status !== 'completed');
  if (pending) {
    await base44.asServiceRole.entities.ClientTask.update(pending.id, {
      status: 'completed',
      completed_date: new Date().toISOString(),
      source_event: sourceEvent,
    });
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const event = body?.event;
    const data = body?.data;

    if (!data || (event?.type !== 'create' && event?.type !== 'update')) {
      return Response.json({ skipped: true, reason: 'Not a create/update event' });
    }

    const clientId = data.client_id;
    const proposalId = data.proposal_id;
    const completed = [];

    // Determine if challenge-type: event_type flag OR linked Service category
    let isChallenge = data.event_type === 'challenge';
    if (!isChallenge && data.service_id) {
      try {
        const svc = await base44.asServiceRole.entities.Service.get(data.service_id);
        if (svc?.category === 'challenge') isChallenge = true;
      } catch { /* service not found — ignore */ }
    }

    // Trigger 1: event_scheduled — complete "Event Scheduling" task (any non-completed status)
    if (proposalId) {
      const did = await completeTask(base44, {
        proposal_id: proposalId,
        description: EVENT_SCHEDULING_TASK,
      }, 'event_scheduled');
      if (did) completed.push('event_scheduling');
    }

    // Trigger 2: challenge_event_created — complete [CHALLENGE] SETUP app task
    if (isChallenge && (proposalId || clientId)) {
      const filter = proposalId
        ? { proposal_id: proposalId, description: CHALLENGE_APP_TASK }
        : { client_id: clientId, description: CHALLENGE_APP_TASK };
      const did = await completeTask(base44, filter, 'challenge_event_created');
      if (did) completed.push('challenge_app_setup');
    }

    return Response.json({ success: true, completed, isChallenge });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});