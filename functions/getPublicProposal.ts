import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Clone the request to read body, since we need to pass original req to SDK
    const clonedReq = req.clone();
    const { proposalId } = await clonedReq.json();
    
    // Create client from request - use service role for public access
    const base44 = createClientFromRequest(req);

    if (!proposalId) {
      return Response.json({ error: 'Proposal ID is required' }, { status: 400 });
    }

    // Use service role to fetch data without requiring user auth
    // Get all proposals and find by ID since filter by id doesn't work reliably
    const allProposals = await base44.asServiceRole.entities.Proposal.list();
    console.log('Found proposals:', allProposals.length, 'Looking for:', proposalId);
    console.log('Proposal IDs:', allProposals.map(p => p.id));
    const proposal = allProposals.find(p => p.id === proposalId) || null;
    console.log('Matched proposal:', proposal ? 'yes' : 'no');

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

    // Fetch services so the client portal can resolve service IDs to names/descriptions
    const services = await base44.asServiceRole.entities.Service.list('sort_order', 500);
    console.log('Proposal selections keys:', Object.keys(proposal.selections || {}));
    console.log('Workshop IDs in proposal:', proposal.selections?.workshops);
    console.log('Services fetched count:', services.length);
    console.log('Service IDs sample:', services.slice(0, 5).map(s => ({ id: s.id, name: s.name })));

    return Response.json({ proposal, client, events, templates, services });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});