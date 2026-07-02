import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { portal_id, contact_name, contact_email, company_name, notes, proposal_id } = await req.json();

  if (!portal_id || !contact_name) {
    return Response.json({ error: 'portal_id and contact_name are required' }, { status: 400 });
  }

  // Find the referral partner by their unique_portal_id
  const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
  if (!partners || partners.length === 0) {
    return Response.json({ error: 'Partner not found' }, { status: 404 });
  }
  const partner = partners[0];

  // Create a Lead record so it shows up in the dashboard
  const lead = await base44.asServiceRole.entities.Lead.create({
    name: contact_name,
    email: contact_email || '',
    company: company_name || '',
    lead_type: 'broker_lead',
    status: 'cold',
    source: `Referral from ${partner.name}`,
    notes: notes || ''
  });

  // Create a Referral record with pending_review status — must be approved before counting toward partner totals
  const referral = await base44.asServiceRole.entities.Referral.create({
    referral_partner_id: partner.id,
    referral_partner_name: partner.name,
    referred_lead_id: lead.id,
    contact_name,
    contact_email: contact_email || '',
    company_name: company_name || '',
    notes: notes || '',
    referral_date: new Date().toISOString(),
    status: 'pending_review',
    ...(proposal_id ? { proposal_id } : {})
  });

  // Log activity for the partner's in-portal feed
  const displayName = company_name || contact_name;
  await base44.asServiceRole.entities.ReferralActivity.create({
    referral_partner_id: partner.id,
    referral_id: referral.id,
    message: `New referral submitted: ${displayName}`,
    activity_date: new Date().toISOString()
  });

  return Response.json({ success: true, referral_id: referral.id, lead_id: lead.id });
});