import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Validates access to a client report and returns the data the report needs.
 * Accepts, in priority order:
 *   1. portal_id  — broker path (existing ownership check: partner owns this client)
 *   2. token      — client portal_token (must match the requested client_id's Client)
 *   3. admin      — authenticated admin caller
 * Anything else returns { allowed: false }.
 * When allowed, also returns client + responses + services (service role, filtered to client).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { portal_id, token, client_id } = body;

    if (!client_id) {
      return Response.json({ allowed: false, error: 'client_id is required' }, { status: 400 });
    }

    let allowed = false;
    let partner_id = null;

    // ── Priority 1: portal_id (broker path — existing ownership check) ──
    if (portal_id) {
      const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
      if (partners && partners.length > 0) {
        const partner = partners[0];
        const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id, referral_partner_id: partner.id });
        if (clients && clients.length > 0) {
          allowed = true;
          partner_id = partner.id;
        }
      }
    }

    // ── Priority 2: token (client portal_token must match the client_id) ──
    if (!allowed && token) {
      const tokenClients = await base44.asServiceRole.entities.Client.filter({ portal_token: token });
      if (tokenClients && tokenClients.length > 0 && tokenClients[0].id === client_id) {
        allowed = true;
      }
    }

    // ── Priority 3: authenticated admin ──
    if (!allowed) {
      try {
        const user = await base44.auth.me();
        if (user?.role === 'admin') {
          allowed = true;
        }
      } catch { /* not authenticated — fall through to denied */ }
    }

    if (!allowed) {
      return Response.json({ allowed: false });
    }

    // ── Fetch client + feedback data (service role, filtered to this client) ──
    const [clients, responses, services] = await Promise.all([
      base44.asServiceRole.entities.Client.filter({ id: client_id }),
      base44.asServiceRole.entities.FeedbackResponse.filter({ client_id }, '-submitted_at', 500),
      base44.asServiceRole.entities.Service.list('sort_order'),
    ]);

    return Response.json({
      allowed: true,
      partner_id,
      client_id,
      client: clients[0] || null,
      responses,
      services,
    });
  } catch (error) {
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
});