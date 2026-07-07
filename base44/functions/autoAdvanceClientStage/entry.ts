import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sales-stage client_stage values. A client in any of these (or with no stage
// set) is eligible to auto-advance to new_client_setup when a proposal is
// accepted. Everything else (program_delivery, nurture, renewal, churned, …)
// is left untouched — those transitions stay with manual edits / autoStageDetection.
const SALES_STAGES = [
  'discovery_call_scheduled',
  'discovery_call_complete',
  'proposal_sent',
  'proposal_viewed',
  'negotiation',
  'verbal_yes',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { trigger, proposal_id, event_id } = await req.json();

    if (!trigger) {
      return Response.json({ error: 'trigger is required' }, { status: 400 });
    }

    const now = () => new Date().toISOString();
    const todayDate = () => now().split('T')[0];

    const logInteraction = async (clientId, proposalId, subject, notes) => {
      await base44.asServiceRole.entities.ClientInteraction.create({
        client_id: clientId,
        proposal_id: proposalId || null,
        interaction_type: 'note',
        channel: 'other',
        date: now(),
        subject,
        notes,
        outcome: 'Automatic stage transition',
      });
    };

    // ── (1) Proposal accepted → new_client_setup ────────────────────────────
    if (trigger === 'proposal_accepted') {
      if (!proposal_id) {
        return Response.json({ error: 'proposal_id is required' }, { status: 400 });
      }
      const proposals = await base44.asServiceRole.entities.Proposal.filter({ id: proposal_id });
      const proposal = proposals[0];
      if (!proposal) return Response.json({ transitioned: false, reason: 'proposal not found' });
      if (proposal.status !== 'accepted') {
        return Response.json({ transitioned: false, reason: 'proposal not accepted' });
      }
      if (!proposal.client_id) {
        return Response.json({ transitioned: false, reason: 'no linked client' });
      }

      const clients = await base44.asServiceRole.entities.Client.filter({ id: proposal.client_id });
      const client = clients[0];
      if (!client) return Response.json({ transitioned: false, reason: 'client not found' });

      const currentStage = client.client_stage || '';
      if (currentStage && !SALES_STAGES.includes(currentStage)) {
        return Response.json({
          transitioned: false,
          reason: `client stage is '${currentStage}' (not a sales stage)`,
          client_id: client.id,
          client_name: client.name,
        });
      }

      await base44.asServiceRole.entities.Client.update(client.id, {
        client_stage: 'new_client_setup',
        stage_entered_date: todayDate(),
      });
      await logInteraction(
        client.id,
        proposal.id,
        'Proposal accepted — stage → New Client Setup',
        `Proposal for "${proposal.client_name || ''}" was marked accepted. Client stage auto-advanced from "${currentStage || 'empty'}" to "new_client_setup".`,
      );

      return Response.json({
        transitioned: true,
        client_id: client.id,
        client_name: client.name,
        from_stage: currentStage || 'empty',
        to_stage: 'new_client_setup',
      });
    }

    // ── (2) First completed event for an accepted proposal → program_delivery
    if (trigger === 'event_completed') {
      if (!event_id) {
        return Response.json({ error: 'event_id is required' }, { status: 400 });
      }
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
      const event = events[0];
      if (!event) return Response.json({ transitioned: false, reason: 'event not found' });
      if (!event.completed) {
        return Response.json({ transitioned: false, reason: 'event not completed' });
      }
      if (!event.proposal_id) {
        return Response.json({ transitioned: false, reason: 'no linked proposal' });
      }

      const proposals = await base44.asServiceRole.entities.Proposal.filter({ id: event.proposal_id });
      const proposal = proposals[0];
      if (!proposal || proposal.status !== 'accepted') {
        return Response.json({ transitioned: false, reason: 'linked proposal not accepted' });
      }
      if (!proposal.client_id) {
        return Response.json({ transitioned: false, reason: 'no linked client' });
      }

      // Only the FIRST completed event for this proposal triggers the advance.
      const proposalEvents = await base44.asServiceRole.entities.CalendarEvent.filter(
        { proposal_id: event.proposal_id },
        'completed_date',
        500,
      );
      const completedEvents = proposalEvents
        .filter((e) => e.completed)
        .sort((a, b) => new Date(a.completed_date || a.updated_date) - new Date(b.completed_date || b.updated_date));
      if (completedEvents.length === 0 || completedEvents[0].id !== event.id) {
        return Response.json({ transitioned: false, reason: 'not the first completed event for this proposal' });
      }

      const clients = await base44.asServiceRole.entities.Client.filter({ id: proposal.client_id });
      const client = clients[0];
      if (!client) return Response.json({ transitioned: false, reason: 'client not found' });

      if (client.client_stage !== 'new_client_setup') {
        return Response.json({
          transitioned: false,
          reason: `client stage is '${client.client_stage || 'empty'}' (not new_client_setup)`,
          client_id: client.id,
          client_name: client.name,
        });
      }

      await base44.asServiceRole.entities.Client.update(client.id, {
        client_stage: 'program_delivery',
        stage_entered_date: todayDate(),
      });
      await logInteraction(
        client.id,
        proposal.id,
        'First session completed — stage → Program Delivery',
        `Event "${event.title || ''}" was the first completed session for the accepted proposal ("${proposal.client_name || ''}"). Client stage auto-advanced from "new_client_setup" to "program_delivery".`,
      );

      return Response.json({
        transitioned: true,
        client_id: client.id,
        client_name: client.name,
        from_stage: 'new_client_setup',
        to_stage: 'program_delivery',
        event_title: event.title || '',
      });
    }

    return Response.json({ error: `unknown trigger: ${trigger}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});