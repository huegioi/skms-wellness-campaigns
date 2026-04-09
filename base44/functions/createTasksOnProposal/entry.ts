import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_TASKS = [
  // Phase 1: Sales & Setup
  'Client Profile: Create a profile with all necessary demographic and organizational information',
  'Proposal Creation: Draft a tailored proposal addressing specific client pain points like burnout or disengagement',
  'Acceptance: Confirm the proposal has been officially accepted',
  'Invoicing: Create and send the invoice to the client',
  'Payment Confirmation: Verify and record that payment has been received',
  // Phase 2: Planning & Launch
  'Event Scheduling: Finalize dates for ideation calls, workshops, and challenges',
  'Presenter Briefing: Ensure presenters have the correct information and client vignettes to personalize the delivery',
  'Portal & Templates: Upload or send email templates for each event and grant access to the client portal',
  'Pre-Survey: Send the initial assessment or Team Emotional Resilience Survey to establish baseline data',
  // Phase 3: Implementation & Sustainment
  'Follow-up Materials: Upload recordings and session materials (PDF workbooks, meditations) to the portal immediately after each presentation',
  'Post-Survey: Send the follow-up survey to measure growth in key skills like adaptability and communication',
  'ROI Reporting: Send a comprehensive ROI report to the client to demonstrate program impact',
  'Closing Email: Send a final follow-up email to discuss ongoing support or small-group coaching',
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