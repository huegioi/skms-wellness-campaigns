import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data } = body;

    if (event?.type !== 'delete') {
      return Response.json({ skipped: true, reason: 'Not a delete event' });
    }

    const proposalId = event?.entity_id || data?.id;
    if (!proposalId) {
      return Response.json({ skipped: true, reason: 'No proposal ID found' });
    }

    // Find and delete all tasks tied to this proposal
    const tasks = await base44.asServiceRole.entities.ClientTask.filter({ proposal_id: proposalId });

    if (tasks.length === 0) {
      return Response.json({ skipped: true, reason: 'No tasks found for this proposal' });
    }

    await Promise.all(tasks.map(t => base44.asServiceRole.entities.ClientTask.delete(t.id)));

    return Response.json({ success: true, deleted: tasks.length, proposalId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});