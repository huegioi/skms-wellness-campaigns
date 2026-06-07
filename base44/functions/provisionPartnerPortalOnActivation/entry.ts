import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fires when a ReferralPartner record is created or updated.
 * If the partner is active and has no portal ID yet, generates one.
 * No email is sent — portal links are sent by hand from ReferralPartnerAdmin.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { data: partner } = body;

  // Provision if is_active=true OR partner_status='Active Partner', and no portal yet
  const isActive = partner?.is_active === true || partner?.partner_status === 'Active Partner';
  if (!partner || !isActive || partner.unique_portal_id) {
    return Response.json({ skipped: true, reason: 'Not active or portal already exists' });
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!partner.email || !emailRegex.test(partner.email)) {
    return Response.json({ skipped: true, reason: 'Partner email is missing or invalid' });
  }

  // Generate unique portal ID
  const uniquePortalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

  await base44.asServiceRole.entities.ReferralPartner.update(partner.id, {
    unique_portal_id: uniquePortalId,
    is_active: true,
  });

  const appBaseUrl = 'https://curriculum-designer-05b51a3b.base44.app';
  const portalUrl = `${appBaseUrl}/ReferralPortal?id=${uniquePortalId}`;

  console.log(`[provisionPartnerPortalOnActivation] Provisioned portal for ${partner.email} — ${portalUrl}`);

  // Also sync any matching broker_lead Lead records to active_partner status
  const matchingLeads = await base44.asServiceRole.entities.Lead.filter({
    email: partner.email,
    lead_type: 'broker_lead',
  });
  for (const lead of matchingLeads) {
    if (lead.partner_status !== 'active_partner') {
      await base44.asServiceRole.entities.Lead.update(lead.id, { partner_status: 'active_partner' });
    }
  }

  return Response.json({
    success: true,
    partner_id: partner.id,
    portal_id: uniquePortalId,
    portal_url: portalUrl,
    leads_updated: matchingLeads.length,
  });
});