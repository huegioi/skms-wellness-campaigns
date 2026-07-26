import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { event, data } = await req.json();

  const referral = data;

  // Only provision when a referral has been purchased AND manually reviewed/verified
  if (!referral || referral.status !== 'purchased' || !referral.reviewed_date) {
    return Response.json({ skipped: true, reason: 'Referral not yet purchased and reviewed' });
  }

  // Look up the ReferralPartner for this referral
  if (!referral.referral_partner_id) {
    return Response.json({ skipped: true, reason: 'No referral_partner_id on referral' });
  }

  // Check if a ReferralPartner portal already exists (unique_portal_id is the indicator)
  const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ id: referral.referral_partner_id });
  if (!partners || partners.length === 0) {
    return Response.json({ skipped: true, reason: 'ReferralPartner not found' });
  }

  const partner = partners[0];

  // If they already have a portal ID, nothing to do
  if (partner.unique_portal_id) {
    return Response.json({ skipped: true, reason: 'Portal already exists', partner_id: partner.id });
  }

  // Validate email before provisioning
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!partner.email || !emailRegex.test(partner.email)) {
    return Response.json({ skipped: true, reason: 'Partner email is missing or invalid' });
  }

  // Generate a unique portal ID and assign it
  const uniquePortalId = crypto.randomUUID();

  await base44.asServiceRole.entities.ReferralPartner.update(partner.id, {
    unique_portal_id: uniquePortalId,
    is_active: true,
  });

  // Also update any matching Lead records to active_partner status
  const matchingLeads = await base44.asServiceRole.entities.Lead.filter({
    email: partner.email,
    lead_type: 'broker_lead',
    is_archived: { $ne: true },
  });
  for (const lead of matchingLeads) {
    if (lead.partner_status !== 'active_partner') {
      await base44.asServiceRole.entities.Lead.update(lead.id, { partner_status: 'active_partner' });
    }
  }

  return Response.json({ success: true, partner_id: partner.id, portal_id: uniquePortalId, leads_updated: matchingLeads.length });
});