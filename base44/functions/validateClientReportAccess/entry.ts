import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Validates that a given portal_id owns the given client_id.
 * Returns { allowed: true, client } or { allowed: false }.
 * Used by ClientReport to prevent unauthorized cross-broker data access.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { portal_id, client_id } = await req.json();

  if (!portal_id || !client_id) {
    return Response.json({ allowed: false, error: 'portal_id and client_id are required' }, { status: 400 });
  }

  // Verify the portal belongs to a real partner
  const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
  if (!partners || partners.length === 0) {
    return Response.json({ allowed: false, error: 'Partner not found' }, { status: 403 });
  }
  const partner = partners[0];

  // Verify this client is actually owned by this partner
  const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id, referral_partner_id: partner.id });
  if (!clients || clients.length === 0) {
    return Response.json({ allowed: false, error: 'Access denied: client does not belong to this partner' }, { status: 403 });
  }

  return Response.json({ allowed: true, partner_id: partner.id, client_id });
});