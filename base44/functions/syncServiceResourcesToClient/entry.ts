import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Can be called manually with { client_id } or triggered by entity automation (proposal update)
    const clientIdFromPayload = body.data?.client_id; // entity automation payload
    const { client_id: clientIdDirect } = body;
    const client_id = clientIdDirect || clientIdFromPayload;

    if (!client_id) {
      return Response.json({ error: 'client_id is required' }, { status: 400 });
    }

    // Get the client
    let client;
    try {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
      client = clients[0];
    } catch(e) {
      // try direct get
      try {
        client = await base44.asServiceRole.entities.Client.get('Client', client_id);
      } catch(_) {}
    }
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all accepted proposals for this client
    const allProposals = await base44.asServiceRole.entities.Proposal.list('-created_date');
    const acceptedProposals = allProposals.filter(
      p => p.client_id === client_id && p.status === 'accepted'
    );

    if (acceptedProposals.length === 0) {
      return Response.json({ skipped: true, reason: 'No accepted proposals for this client' });
    }

    // Collect all service IDs from accepted proposals
    const serviceIds = new Set();
    for (const proposal of acceptedProposals) {
      const sel = proposal.selections || {};
      for (const ids of [sel.workshops, sel.challengePrograms, sel.leadership, sel.movementClasses]) {
        (ids || []).forEach(id => serviceIds.add(id));
      }
    }

    if (serviceIds.size === 0) {
      return Response.json({ skipped: true, reason: 'No services found in accepted proposals' });
    }

    // Fetch all services that have resources
    const allServices = await base44.asServiceRole.entities.Service.list('sort_order');
    const relevantServices = allServices.filter(
      s => serviceIds.has(s.id) && s.resources?.length > 0
    );

    if (relevantServices.length === 0) {
      return Response.json({ skipped: true, reason: 'No service resources found for purchased services' });
    }

    // Build the new resources to add, mapping service resources → session_resources format
    const existingResources = client.session_resources || [];
    const existingUrls = new Set(existingResources.map(r => r.url));

    const resourcesToAdd = [];
    for (const service of relevantServices) {
      for (const resource of service.resources) {
        if (!existingUrls.has(resource.file_url)) {
          resourcesToAdd.push({
            title: resource.title,
            url: resource.file_url,
            resource_type: resource.resource_type === 'guide' ? 'handout' : resource.resource_type,
            session_name: service.name,
            added_date: new Date().toISOString(),
            source_service_id: service.id,
          });
          existingUrls.add(resource.file_url);
        }
      }
    }

    if (resourcesToAdd.length === 0) {
      return Response.json({ skipped: true, reason: 'All service resources already exist in client portal' });
    }

    const updatedResources = [...existingResources, ...resourcesToAdd];
    await base44.asServiceRole.entities.Client.update(client_id, {
      session_resources: updatedResources,
    });

    return Response.json({
      success: true,
      added: resourcesToAdd.length,
      total: updatedResources.length,
      services_synced: relevantServices.map(s => s.name),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});