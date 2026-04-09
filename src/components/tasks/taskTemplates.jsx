export const DEFAULT_CLIENT_TASKS = [
  // Phase 1: Sales & Setup
  { description: 'Phase 1: Sales & Setup', order: 0, isPhaseHeader: true },
  { description: 'Client Profile: Create a profile with all necessary demographic and organizational information', order: 1 },
  { description: 'Proposal Creation: Draft a tailored proposal addressing specific client pain points like burnout or disengagement', order: 2 },
  { description: 'Acceptance: Confirm the proposal has been officially accepted', order: 3 },
  { description: 'Invoicing: Create and send the invoice to the client', order: 4 },
  { description: 'Payment Confirmation: Verify and record that payment has been received', order: 5 },
  // Phase 2: Planning & Launch
  { description: 'Phase 2: Planning & Launch', order: 6, isPhaseHeader: true },
  { description: 'Event Scheduling: Finalize dates for ideation calls, workshops, and challenges', order: 7 },
  { description: 'Presenter Briefing: Ensure presenters have the correct information and client vignettes to personalize the delivery', order: 8 },
  { description: 'Portal & Templates: Upload or send email templates for each event and grant access to the client portal', order: 9 },
  { description: 'Pre-Survey: Send the initial assessment or Team Emotional Resilience Survey to establish baseline data', order: 10 },
  // Phase 3: Implementation & Sustainment
  { description: 'Phase 3: Implementation & Sustainment', order: 11, isPhaseHeader: true },
  { description: 'Follow-up Materials: Upload recordings and session materials (PDF workbooks, meditations) to the portal immediately after each presentation', order: 12 },
  { description: 'Post-Survey: Send the follow-up survey to measure growth in key skills like adaptability and communication', order: 13 },
  { description: 'ROI Reporting: Send a comprehensive ROI report to the client to demonstrate program impact', order: 14 },
  { description: 'Closing Email: Send a final follow-up email to discuss ongoing support or small-group coaching', order: 15 },
];

export async function createDefaultTasksForClient(base44, clientId, clientName, proposalId = null) {
  const taskPromises = DEFAULT_CLIENT_TASKS
    .filter(template => !template.isPhaseHeader)
    .map(template =>
    base44.entities.ClientTask.create({
      client_id: clientId,
      client_name: clientName,
      proposal_id: proposalId,
      description: template.description,
      task_order: template.order,
      status: 'pending',
      auto_generated: true,
      source_event: proposalId ? 'new_proposal' : 'new_client'
    })
  );

  return Promise.all(taskPromises);
}

export async function markTaskComplete(base44, clientId, taskDescription, sourceEvent, proposalId = null) {
  const filter = proposalId 
    ? { client_id: clientId, proposal_id: proposalId, description: taskDescription, status: 'pending' }
    : { client_id: clientId, description: taskDescription, status: 'pending' };
    
  const tasks = await base44.entities.ClientTask.filter(filter);
  
  if (tasks.length > 0) {
    const task = tasks[0];
    await base44.entities.ClientTask.update(task.id, {
      status: 'completed',
      completed_date: new Date().toISOString(),
      source_event: sourceEvent
    });
  }
}