import { createClient } from 'npm:@base44/sdk@0.8.4';

const base44 = createClient({
  appId: Deno.env.get('BASE44_APP_ID')
});

Deno.serve(async (req) => {
  try {
    const { proposalId } = await req.json();

    if (!proposalId) {
      return Response.json({ error: 'Proposal ID is required' }, { status: 400 });
    }

    // Use service role to fetch data without requiring user auth
    const proposals = await base44.asServiceRole.entities.Proposal.filter({ id: proposalId });
    const proposal = proposals[0] || null;

    if (!proposal) {
      return Response.json({ proposal: null, client: null, events: [] });
    }

    let client = null;
    let events = [];

    if (proposal.client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: proposal.client_id });
      client = clients[0] || null;

      events = await base44.asServiceRole.entities.CalendarEvent.filter(
        { client_id: proposal.client_id }, 
        'start_date'
      );
    }

    return Response.json({ proposal, client, events });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});