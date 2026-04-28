import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_TASKS = [
  { description: 'Client Profile: Create a profile with all necessary demographic and organizational information', order: 1 },
  { description: 'Proposal Creation: Draft a tailored proposal addressing specific client pain points like burnout or disengagement', order: 2 },
  { description: 'Acceptance: Confirm the proposal has been officially accepted', order: 3 },
  { description: 'Invoicing: Create and send the invoice to the client', order: 4 },
  { description: 'Payment Confirmation: Verify and record that payment has been received', order: 5 },
  { description: 'Event Scheduling: Finalize dates for ideation calls, workshops, and challenges', order: 6 },
  { description: 'Presenter Briefing: Ensure presenters have the correct information and client vignettes to personalize the delivery', order: 7 },
  { description: 'Portal & Templates: Upload or send email templates for each event and grant access to the client portal', order: 8 },
  { description: 'Pre-Survey: Send the initial assessment or Team Emotional Resilience Survey to establish baseline data', order: 9 },
  { description: 'Follow-up Materials: Upload recordings and session materials (PDF workbooks, meditations) to the portal immediately after each presentation', order: 10 },
  { description: 'Post-Survey: Send the follow-up survey to measure growth in key skills like adaptability and communication', order: 11 },
  { description: 'ROI Reporting: Send a comprehensive ROI report to the client to demonstrate program impact', order: 12 },
  { description: 'Closing Email: Send a final follow-up email to discuss ongoing support or small-group coaching', order: 13 },
];

const CHALLENGE_TASKS = [
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
  // 🔁 DURING
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data } = body;

    if (!data?.client_id) {
      return Response.json({ skipped: true, reason: 'No client_id on proposal' });
    }

    const proposal = data;
    const hasChallenge = (proposal.selections?.challengePrograms?.length || 0) > 0;

    // On CREATE: create all default tasks (+ challenge tasks if applicable)
    if (event?.type === 'create') {
      const existing = await base44.asServiceRole.entities.ClientTask.filter({ proposal_id: proposal.id });
      if (existing.length > 0) {
        return Response.json({ skipped: true, reason: 'Tasks already exist for this proposal' });
      }

      const allTasks = hasChallenge ? [...DEFAULT_TASKS, ...CHALLENGE_TASKS] : DEFAULT_TASKS;
      await Promise.all(allTasks.map(t =>
        base44.asServiceRole.entities.ClientTask.create({
          client_id: proposal.client_id,
          client_name: proposal.client_name || '',
          proposal_id: proposal.id,
          description: t.description,
          task_order: t.order,
          status: 'pending',
          auto_generated: true,
          source_event: 'proposal_created',
        })
      ));

      return Response.json({ success: true, created: allTasks.length, hasChallenge });
    }

    // On UPDATE: if proposal now has challenges, add any missing challenge tasks
    if (event?.type === 'update' && hasChallenge) {
      const existing = await base44.asServiceRole.entities.ClientTask.filter({ proposal_id: proposal.id });
      const existingDescriptions = new Set(existing.map(t => t.description));

      const missingChallengeTasks = CHALLENGE_TASKS.filter(t => !existingDescriptions.has(t.description));

      if (missingChallengeTasks.length === 0) {
        return Response.json({ skipped: true, reason: 'Challenge tasks already exist' });
      }

      await Promise.all(missingChallengeTasks.map(t =>
        base44.asServiceRole.entities.ClientTask.create({
          client_id: proposal.client_id,
          client_name: proposal.client_name || '',
          proposal_id: proposal.id,
          description: t.description,
          task_order: t.order,
          status: 'pending',
          auto_generated: true,
          source_event: 'challenge_added',
        })
      ));

      return Response.json({ success: true, added: missingChallengeTasks.length });
    }

    return Response.json({ skipped: true, reason: 'No action needed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});