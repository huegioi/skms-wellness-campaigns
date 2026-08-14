import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { resolvePortalTemplates } from '../../shared/templatePersonalization.ts';

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
    const proposal = allProposals.find(p => p.id === proposalId) || null;

    if (!proposal) {
      return Response.json({ proposal: null, client: null, events: [], templates: [] });
    }

    let client = null;
    let events = [];
    let templates = [];

    if (proposal.client_id) {
      client = (await base44.asServiceRole.entities.Client.filter({ id: proposal.client_id }))[0] || null;
      events = await base44.asServiceRole.entities.CalendarEvent.filter({ client_id: proposal.client_id }, 'start_date');
    }

    // Fetch services so the client portal can resolve service IDs to names/descriptions
    const services = await base44.asServiceRole.entities.Service.list('sort_order', 500);

    // Same server-side matching + personalization as getClientPortalData:
    // purchased service with a booked event, manual assignment, or
    // client-specific — never the whole template library.
    if (client) {
      const allTemplates = await base44.asServiceRole.entities.EmailTemplate.list('service_category');
      templates = resolvePortalTemplates({
        client,
        proposals: [proposal],
        clientEvents: events,
        templates: allTemplates,
        services,
      });
    }

    return Response.json({ proposal, client, events, templates, services });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});