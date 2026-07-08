import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { partner_id, referral_id, amount, payment_date } = body;

    if (!partner_id || !amount || amount <= 0) {
      return Response.json({ error: 'partner_id and a positive amount are required' }, { status: 400 });
    }

    const partner = await base44.asServiceRole.entities.ReferralPartner.get(partner_id);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });

    const date = payment_date || new Date().toISOString().slice(0, 10);
    const activityDate = new Date(date).toISOString();

    // Resolve referral (optional)
    let linkedReferral = null;
    if (referral_id) {
      linkedReferral = await base44.asServiceRole.entities.Referral.get(referral_id);
      if (!linkedReferral) return Response.json({ error: 'Referral not found' }, { status: 404 });
      if (linkedReferral.referral_partner_id !== partner_id) {
        return Response.json({ error: 'Referral does not belong to this partner' }, { status: 400 });
      }
    }

    // Build message
    let message = `Commission payment of $${Number(amount).toLocaleString()}`;
    if (linkedReferral) {
      const label = linkedReferral.company_name || linkedReferral.contact_name || 'referral';
      message = `Commission payment of $${Number(amount).toLocaleString()} for ${label}`;
    }

    // Create payment activity
    await base44.asServiceRole.entities.ReferralActivity.create({
      referral_partner_id: partner_id,
      referral_id: referral_id || null,
      message,
      activity_date: activityDate,
      activity_type: 'commission_payment',
      amount: Number(amount),
    });

    // Increment partner total
    const newTotal = (partner.total_commissions_paid || 0) + Number(amount);
    await base44.asServiceRole.entities.ReferralPartner.update(partner_id, {
      total_commissions_paid: newTotal,
    });

    // Check if referral's full commission is now covered
    let commissionFullyPaid = false;
    if (linkedReferral && linkedReferral.commission_amount > 0) {
      const payments = await base44.asServiceRole.entities.ReferralActivity.filter({
        referral_id: linkedReferral.id,
        activity_type: 'commission_payment',
      });
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (totalPaid >= linkedReferral.commission_amount) {
        await base44.asServiceRole.entities.Referral.update(linkedReferral.id, {
          status: 'commission_paid',
        });
        commissionFullyPaid = true;
      }
    }

    return Response.json({
      success: true,
      partner_id,
      amount: Number(amount),
      new_total_commissions_paid: newTotal,
      commission_fully_paid: commissionFullyPaid,
    });
  } catch (error) {
    console.error('recordCommissionPayment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});