import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Resolves the authenticated caller's Client record by email or email2,
 * then returns their portal_token — generating one via crypto.randomUUID()
 * if missing. Used by MyPortal so existing logged-in clients keep working.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find client by email, then email2
    let client = null;
    const byEmail = await base44.asServiceRole.entities.Client.filter({ email: user.email });
    if (byEmail.length > 0) {
      client = byEmail[0];
    } else {
      const byEmail2 = await base44.asServiceRole.entities.Client.filter({ email2: user.email });
      if (byEmail2.length > 0) {
        client = byEmail2[0];
      }
    }

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Generate token if missing
    if (!client.portal_token) {
      const newToken = crypto.randomUUID();
      await base44.asServiceRole.entities.Client.update(client.id, {
        portal_token: newToken,
      });
      return Response.json({ portal_token: newToken });
    }

    return Response.json({ portal_token: client.portal_token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});