import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Create client with app ID only - no user auth required
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      apiKey: Deno.env.get('BASE44_API_KEY')
    });
    
    const { proposalId } = await req.json();

    if (!proposalId) {
      return Response.json({ error: 'Proposal ID is required' }, { status: 400 });
    }

    // Use service role to fetch data without requiring user auth
    // Get all proposals and find by ID since filter by id doesn't work reliably
    const allProposals = await base44.asServiceRole.entities.Proposal.list();
    const proposal = allProposals.find(p => p.id === proposalId) || null;

    if (!proposal) {
      return Response.json({ proposal: null, client: null, events: [], templates: [] });
    }

    let client = null;
    let events = [];
    let templates = [];

    if (proposal.client_id) {
      const allClients = await base44.asServiceRole.entities.Client.list();
      client = allClients.find(c => c.id === proposal.client_id) || null;

      const allEvents = await base44.asServiceRole.entities.CalendarEvent.list('start_date');
      events = allEvents.filter(e => e.client_id === proposal.client_id);
    }

    // Fetch email templates
    templates = await base44.asServiceRole.entities.EmailTemplate.list('service_category');

    return Response.json({ proposal, client, events, templates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});