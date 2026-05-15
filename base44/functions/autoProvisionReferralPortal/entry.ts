import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { event, data } = await req.json();

  const lead = data;

  // Only act when partner_status is active_partner
  if (!lead || lead.partner_status !== 'active_partner') {
    return Response.json({ skipped: true });
  }

  // Validate that lead has a proper email address before provisioning
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!lead.email || !emailRegex.test(lead.email)) {
    return Response.json({ skipped: true, reason: 'Lead email is missing or invalid — not provisioning portal' });
  }

  // Check if a ReferralPartner already exists for this lead (by email)
  const existing = await base44.asServiceRole.entities.ReferralPartner.filter({ email: lead.email });
  if (existing && existing.length > 0) {
    return Response.json({ skipped: true, reason: 'Portal already exists', partner_id: existing[0].id });
  }

  // Generate a unique portal ID
  const uniquePortalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

  // Default commission tiers from the broker partnership agreement
  const defaultTiers = [
    { label: 'Tier 1', min_revenue: 0, max_revenue: 49999, rate: 0.08 },
    { label: 'Tier 2', min_revenue: 50000, max_revenue: 99999, rate: 0.10 },
    { label: 'Tier 3', min_revenue: 100000, max_revenue: null, rate: 0.12 },
  ];

  // Clean name: strip any email addresses that may have been concatenated
  const cleanName = (lead.name || '').replace(/\s*[^\s@]+@[^\s@]+\.[^\s@]+/g, '').trim();

  const partner = await base44.asServiceRole.entities.ReferralPartner.create({
    name: cleanName || lead.name,
    email: lead.email,
    company: lead.company || '',
    phone: lead.phone || '',
    unique_portal_id: uniquePortalId,
    commission_tiers: defaultTiers,
    is_active: true,
    notes: `Auto-provisioned from Lead ID: ${lead.id}`
  });

  return Response.json({ success: true, partner_id: partner.id, portal_id: uniquePortalId });
});