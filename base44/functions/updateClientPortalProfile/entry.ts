import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const WHITELIST = [
  'name', 'email', 'email2', 'phone', 'title',
  'company', 'company_address', 'company_website'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, updates } = await req.json();

    if (!token) {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    // Look up the client by portal_token (service role — no auth required)
    const clients = await base44.asServiceRole.entities.Client.filter({ portal_token: token });
    if (!clients.length) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    // Extract only whitelisted fields — ignore everything else
    const safeUpdates = {};
    for (const key of WHITELIST) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    const updated = await base44.asServiceRole.entities.Client.update(client.id, safeUpdates);
    return Response.json({ client: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});