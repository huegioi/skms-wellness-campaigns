export const DEFAULT_CLIENT_TASKS = [
  // Phase 1: Sales & Setup
  { description: 'Client Profile: Create a profile with all necessary demographic and organizational information', order: 1 },
  { description: 'Proposal Creation: Draft a tailored proposal addressing specific client pain points like burnout or disengagement', order: 2 },
  { description: 'Acceptance: Confirm the proposal has been officially accepted', order: 3 },
  { description: 'Invoicing: Create and send the invoice to the client', order: 4 },
  { description: 'Payment Confirmation: Verify and record that payment has been received', order: 5 },
  // Phase 2: Planning & Launch
  { description: 'Event Scheduling: Finalize dates for ideation calls, workshops, and challenges', order: 7 },
  { description: 'Presenter Briefing: Ensure presenters have the correct information and client vignettes to personalize the delivery', order: 8 },
  { description: 'Portal & Templates: Upload or send email templates for each event and grant access to the client portal', order: 9 },
  { description: 'Pre-Survey: Send the initial assessment or Team Emotional Resilience Survey to establish baseline data', order: 10 },
  // Phase 3: Implementation & Sustainment
  { description: 'Follow-up Materials: Upload recordings and session materials (PDF workbooks, meditations) to the portal immediately after each presentation', order: 12 },
  { description: 'Post-Survey: Send the follow-up survey to measure growth in key skills like adaptability and communication', order: 13 },
  { description: 'ROI Reporting: Send a comprehensive ROI report to the client to demonstrate program impact', order: 14 },
  { description: 'Closing Email: Send a final follow-up email to discuss ongoing support or small-group coaching', order: 15 },
];

export const CHALLENGE_TASKS = [
  // 📋 SETUP
  { description: '[CHALLENGE] SETUP — Challenge added to the events spreadsheet with correct date, client name, and challenge type', order: 20 },
  { description: '[CHALLENGE] SETUP — Challenge added to the SkillfulMeans app with event details', order: 21 },
  { description: '[CHALLENGE] SETUP — Sync to Google Calendar clicked in the app to confirm it loaded correctly', order: 22 },
  { description: '[CHALLENGE] SETUP — Message Serge to create the challenge registration page in Kajabi', order: 23 },
  { description: '[CHALLENGE] SETUP — Registration page reviewed and approved by William — confirm image is centered, text is correct, purchasing flow works, correct email sequence is attached (e.g. "True North Challenge Confirmation")', order: 24 },
  { description: '[CHALLENGE] SETUP — Any feedback sent back to Serge with a screen recording if edits are needed', order: 25 },
  // 📣 PROMOTION
  { description: '[CHALLENGE] PROMOTION — Promotional registration email drafted by Heather with the registration link', order: 26 },
  { description: '[CHALLENGE] PROMOTION — Registration email sent to client contact so they can distribute to employees', order: 27 },
  { description: '[CHALLENGE] PROMOTION — Confirm client is actively promoting to their team', order: 28 },
  // 🔁 DURING THE CHALLENGE
  { description: '[CHALLENGE] DURING — Daily posts scheduled in advance (Heather schedules; William or presenter creates content)', order: 29 },
  { description: '[CHALLENGE] DURING — Moderator introduction post published by William or assigned presenter before Day 1', order: 30 },
  { description: '[CHALLENGE] DURING — Moderator actively facilitating the discussion board throughout the 14 days', order: 31 },
  // 📊 WRAP-UP
  { description: '[CHALLENGE] WRAP-UP — Participant report pulled — list of all registrants, engagement points, leaderboard standings', order: 32 },
  { description: '[CHALLENGE] WRAP-UP — Report sent to client contact', order: 33 },
  { description: '[CHALLENGE] WRAP-UP — Winners identified for wellness box prizes (if applicable)', order: 34 },
  { description: '[CHALLENGE] WRAP-UP — Wellness boxes ordered and shipped to winners (Heather fulfills via Kajabi/Tango)', order: 35 },
  { description: '[CHALLENGE] WRAP-UP — Follow-up email sent to client — recap, results, and pitch for next engagement (workshop, series, or repeat challenge)', order: 36 },
];

export async function createDefaultTasksForClient(base44, clientId, clientName, proposal = null) {
  const proposalId = proposal?.id || null;
  const hasChallenge = proposal?.selections?.challengePrograms?.length > 0;

  const allTasks = hasChallenge
    ? [...DEFAULT_CLIENT_TASKS, ...CHALLENGE_TASKS]
    : DEFAULT_CLIENT_TASKS;

  const taskPromises = allTasks.map(template =>
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