import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fires when a Lead entity is updated.
 * If partner_status just changed to 'active_partner', upsert a matching
 * ReferralPartner record by email and generate a portal ID if needed.
 * No email is sent — portal links are sent by hand from ReferralPartnerAdmin.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const { data: lead, old_data } = body;

  // Only act when partner_status just became 'active_partner'
  const justActivated =
    lead?.partner_status === 'active_partner' &&
    old_data?.partner_status !== 'active_partner';

  if (!justActivated) {
    return Response.json({ skipped: true, reason: 'No partner_status→active_partner transition' });
  }

  // Only bridge broker_lead types
  if (lead.lead_type !== 'broker_lead') {
    return Response.json({ skipped: true, reason: 'Not a broker_lead' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!lead.email || !emailRegex.test(lead.email)) {
    return Response.json({ skipped: true, reason: 'Lead has no valid email' });
  }

  const emailLower = lead.email.toLowerCase();

  // Find existing ReferralPartner by email
  const allPartners = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 500);
  const existing = allPartners.find(p => p.email?.toLowerCase() === emailLower);

  let partnerId;
  let portalId;
  let action;

  if (existing) {
    partnerId = existing.id;
    if (existing.unique_portal_id) {
      // Already fully provisioned — just ensure active flags are set
      portalId = existing.unique_portal_id;
      if (!existing.is_active || existing.partner_status !== 'Active Partner') {
        await base44.asServiceRole.entities.ReferralPartner.update(existing.id, {
          is_active: true,
          partner_status: 'Active Partner',
        });
      }
      action = 'already_provisioned';
    } else {
      // Has partner record but no portal — generate one
      portalId = crypto.randomUUID();
      await base44.asServiceRole.entities.ReferralPartner.update(existing.id, {
        unique_portal_id: portalId,
        is_active: true,
        partner_status: 'Active Partner',
      });
      action = 'updated_partner';
    }
  } else {
    // No ReferralPartner exists — create one from Lead data
    portalId = crypto.randomUUID();
    const newPartner = await base44.asServiceRole.entities.ReferralPartner.create({
      name: lead.name,
      email: lead.email,
      company: lead.company || '',
      phone: lead.phone || '',
      is_active: true,
      partner_status: 'Active Partner',
      unique_portal_id: portalId,
      notes: `Auto-created from Lead record ${lead.id} on ${new Date().toISOString().split('T')[0]}`,
    });
    partnerId = newPartner.id;
    action = 'created_partner';
  }

  const appBaseUrl = 'https://curriculum-designer-05b51a3b.base44.app';
  const portalUrl = `${appBaseUrl}/ReferralPortal?id=${portalId}`;

  console.log(`[bridgeLeadToPartner] ${action} for ${lead.email} — portal: ${portalUrl}`);

  return Response.json({
    success: true,
    action,
    partner_id: partnerId,
    portal_id: portalId,
    portal_url: portalUrl,
  });
});