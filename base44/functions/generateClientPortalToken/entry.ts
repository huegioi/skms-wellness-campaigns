import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Generates (or returns) a portal_token for a Client.
 * Admin-only. Takes client_id. If the client already has a portal_token,
 * returns it as-is unless regenerate: true is passed.
 */

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { client_id, regenerate } = await req.json();
    if (!client_id) {
      return Response.json({ error: 'client_id is required' }, { status: 400 });
    }

    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    if (!clients.length) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clients[0];

    // Return existing token unless regenerate is requested
    if (client.portal_token && !regenerate) {
      return Response.json({ portal_token: client.portal_token });
    }

    const newToken = crypto.randomUUID();
    await base44.asServiceRole.entities.Client.update(client_id, {
      portal_token: newToken,
    });

    return Response.json({ portal_token: newToken });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});