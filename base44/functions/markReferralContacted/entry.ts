import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Lead statuses that count as "beyond New/Contacted"
const ADVANCED_STATUSES = [
  'responded',
  'in_conversation',
  'meeting_scheduled',
  'proposal_sent',
  'converted',
  'current_client',
];

// Referral statuses that are still pre-contact (the "once" guard)
const PRE_CONTACT_STATUSES = ['pending_review', 'submitted'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { event, data, changed_fields } = body;

    let leadId = null;

    if (event?.entity_name === 'Lead' && event?.type === 'update') {
      if (!changed_fields?.includes('status')) {
        return Response.json({ skipped: true, reason: 'status not changed' });
      }
      if (!ADVANCED_STATUSES.includes(data?.status)) {
        return Response.json({ skipped: true, reason: 'status not beyond new/contacted' });
      }
      leadId = data?.id || event?.entity_id;
    } else if (event?.entity_name === 'ClientInteraction' && event?.type === 'create') {
      if (!data?.lead_id) {
        return Response.json({ skipped: true, reason: 'no lead_id on interaction' });
      }
      leadId = data.lead_id;
    } else {
      return Response.json({ skipped: true, reason: 'unhandled event' });
    }

    if (!leadId) return Response.json({ skipped: true, reason: 'no lead id' });

    // Find referrals linked to this lead that are still in pre-contact states
    const referrals = await base44.asServiceRole.entities.Referral.filter({ referred_lead_id: leadId });
    const eligible = referrals.filter((r) => PRE_CONTACT_STATUSES.includes(r.status));

    if (eligible.length === 0) {
      return Response.json({ skipped: true, reason: 'no eligible referrals' });
    }

    const now = new Date().toISOString();
    for (const r of eligible) {
      await base44.asServiceRole.entities.Referral.update(r.id, { status: 'contacted' });
      if (r.referral_partner_id) {
        await base44.asServiceRole.entities.ReferralActivity.create({
          referral_partner_id: r.referral_partner_id,
          referral_id: r.id,
          message: 'Referred lead contacted — referral advanced to Contacted',
          activity_date: now,
          activity_type: 'note',
        });
      }
    }

    return Response.json({ success: true, updated: eligible.length });
  } catch (error) {
    console.error('markReferralContacted error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});