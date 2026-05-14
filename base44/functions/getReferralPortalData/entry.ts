import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { portal_id } = await req.json();

  if (!portal_id) {
    return Response.json({ error: 'portal_id is required' }, { status: 400 });
  }

  const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
  if (!partners || partners.length === 0) {
    return Response.json({ error: 'Partner not found' }, { status: 404 });
  }
  const partner = partners[0];

  // Get all referrals for this partner
  const referrals = await base44.asServiceRole.entities.Referral.filter({ referral_partner_id: partner.id });

  // Calculate commission summary
  const currentYear = new Date().getFullYear();
  const tiers = partner.commission_tiers || [];

  // Sort referrals by date
  referrals.sort((a, b) => new Date(b.referral_date) - new Date(a.referral_date));

  // Compute ytd revenue from referrals
  const ytdReferrals = referrals.filter(r => {
    const year = new Date(r.referral_date).getFullYear();
    return year === currentYear;
  });
  const ytdRevenue = ytdReferrals.reduce((sum, r) => sum + (r.first_year_revenue || 0), 0);

  // Determine current commission tier
  const currentTier = tiers
    .filter(t => ytdRevenue >= t.min_revenue)
    .sort((a, b) => b.min_revenue - a.min_revenue)[0] || null;

  const totalCommissionEarned = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const totalCommissionPaid = partner.total_commissions_paid || 0;
  const commissionPending = totalCommissionEarned - totalCommissionPaid;

  return Response.json({
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      company: partner.company,
      agreement_file_url: partner.agreement_file_url,
      agreement_signed_date: partner.agreement_signed_date,
      commission_tiers: tiers,
      is_active: partner.is_active
    },
    referrals,
    commission_summary: {
      ytd_revenue: ytdRevenue,
      current_tier: currentTier,
      total_earned: totalCommissionEarned,
      total_paid: totalCommissionPaid,
      pending: commissionPending
    }
  });
});