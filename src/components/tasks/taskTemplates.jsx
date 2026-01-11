export const DEFAULT_CLIENT_TASKS = [
  { description: 'Intake Call', order: 1 },
  { description: 'Create Proposal', order: 2 },
  { description: 'Send or Accept Proposal', order: 3 },
  { description: 'Create Invoice', order: 4 },
  { description: 'Send Invoice', order: 5 },
  { description: 'Book times for events and wellness box delivery', order: 6 },
  { description: 'Create Email Templates', order: 7 },
  { description: 'Upload Email Templates and workshop/challenge materials to the client portal', order: 8 },
  { description: 'Send Client Portal Link', order: 9 }
];

export async function createDefaultTasksForClient(base44, clientId, clientName, proposalId = null) {
  const taskPromises = DEFAULT_CLIENT_TASKS.map(template => 
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