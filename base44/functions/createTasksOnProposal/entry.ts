import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_TASKS = [
  'Send welcome email to client',
  'Schedule kickoff call',
  'Send proposal contract/agreement',
  'Confirm event dates and logistics',
  'Send calendar invites',
  'Prepare materials for first session',
  'Send or Accept Proposal',
  'Follow up after first session',
  'Request feedback/testimonial',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data } = body;
    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event' });
    }

    const proposal = data;
    if (!proposal?.client_id) {
      return Response.json({ skipped: true, reason: 'No client_id on proposal' });
    }

    // Check if tasks already exist for this client
    const existing = await base44.asServiceRole.entities.ClientTask.filter({ client_id: proposal.client_id });
    if (existing.length > 0) {
      return Response.json({ skipped: true, reason: 'Tasks already exist for this client' });
    }

    const tasks = DEFAULT_TASKS.map((description, i) => ({
      client_id: proposal.client_id,
      client_name: proposal.client_name || '',
      proposal_id: proposal.id,
      description,
      task_order: i + 1,
      status: 'pending',
      auto_generated: true,
      source_event: 'proposal_created',
    }));

    await Promise.all(tasks.map(t => base44.asServiceRole.entities.ClientTask.create(t)));

    return Response.json({ success: true, created: tasks.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});