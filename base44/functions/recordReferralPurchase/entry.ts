import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Wellness box items count at 50% when computing first-year revenue
// (shared logic — extracted from BrokerLeadDetail's linkProposalMutation)
function calcAdjustedRevenue(proposal) {
  if (!proposal) return 0;
  const s = proposal.selections || {};
  const overrides = s.priceOverrides || {};
  const customCharges = s.customCharges || [];
  const BOX_PRICES = {
    reduceStress: 60, relaxationSleep: 60, largeEmotional: 100,
    largeStressReduction: 120, stressReductionDigital: 50,
    beyondBurnoutDigital: 100, emotionalWellness: 100,
    wintertimeHealthy: 100, newYearFreshStart: 100
  };
  let nonBoxTotal = 0;
  const challengePrice = s.challengePrice || 0;
  (s.workshops || []).forEach(id => nonBoxTotal += (overrides[id] ?? 0));
  (s.challengePrograms || []).forEach(id => nonBoxTotal += (overrides[id] ?? challengePrice));
  (s.leadership || []).forEach(id => nonBoxTotal += (overrides[id] ?? 0));
  (s.movementClasses || []).forEach(id => nonBoxTotal += (overrides[id] ?? 0));
  customCharges.forEach(c => nonBoxTotal += (c.amount || 0));
  let boxTotal = 0;
  const boxQtys = s.sampleBoxQuantities || {};
  Object.entries(boxQtys).forEach(([key, qty]) => { boxTotal += (qty || 0) * (BOX_PRICES[key] || 0); });
  const customBoxQty = s.customBoxQuantity || 0;
  const customBoxItems = s.customBoxItems || [];
  if (customBoxQty > 0 && customBoxItems.length > 0) {
    const unitPrice = customBoxItems.reduce((sum, item) => sum + (item.price || 0), 0);
    boxTotal += customBoxQty * unitPrice;
  }
  const adjusted = nonBoxTotal + boxTotal * 0.5;
  return adjusted > 0 ? adjusted : proposal.total_amount || 0;
}


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { referral_id, proposal_id } = body;
    if (!referral_id || !proposal_id) {
      return Response.json({ error: 'referral_id and proposal_id are required' }, { status: 400 });
    }

    const referral = await base44.asServiceRole.entities.Referral.get(referral_id);
    if (!referral) return Response.json({ error: 'Referral not found' }, { status: 404 });

    const proposal = await base44.asServiceRole.entities.Proposal.get(proposal_id);
    if (!proposal) return Response.json({ error: 'Proposal not found' }, { status: 404 });

    const firstYearRevenue = calcAdjustedRevenue(proposal);

    // Fetch partner (with fallback for deleted records)
    let partner = null;
    if (referral.referral_partner_id) {
      try { partner = await base44.asServiceRole.entities.ReferralPartner.get(referral.referral_partner_id); }
      catch { partner = null; }
    }

    // Update partner YTD first (needed for brokerage aggregate computation)
    const partnerYtdRevenue = (partner?.ytd_revenue || 0) + firstYearRevenue;
    if (firstYearRevenue > 0 && partner) {
      await base44.asServiceRole.entities.ReferralPartner.update(partner.id, { ytd_revenue: partnerYtdRevenue });
    }

    // ─── Brokerage context ───
    let brokerage = null;
    let brokeragePartners = [];
    if (partner?.brokerage_id) {
      try {
        brokerage = await base44.asServiceRole.entities.Brokerage.get(partner.brokerage_id);
        if (brokerage) {
          brokeragePartners = await base44.asServiceRole.entities.ReferralPartner.filter(
            { brokerage_id: partner.brokerage_id, is_demo: false }, '-created_date', 500
          );
        }
      } catch { brokerage = null; }
    }

    // Determine commission tiers and aggregate YTD
    let tiers, aggregateYtd;
    if (brokerage && brokeragePartners.length > 0) {
      tiers = brokerage.commission_tiers || [];
      aggregateYtd = brokeragePartners.reduce((sum, p) =>
        sum + (p.id === partner.id ? partnerYtdRevenue : (p.ytd_revenue || 0)), 0
      );
    } else {
      tiers = partner?.commission_tiers || [];
      aggregateYtd = partnerYtdRevenue;
    }

    const tier = tiers
      .filter(t => aggregateYtd >= (t.min_revenue || 0))
      .sort((a, b) => (b.min_revenue || 0) - (a.min_revenue || 0))[0] || null;
    const commissionRate = tier?.rate || 0;
    const totalCommission = firstYearRevenue * commissionRate;

    // Allocate commission per brokerage toggles/split
    let brokerageCommission = 0;
    let brokerCommission = 0;
    if (brokerage) {
      const brokerageEnabled = brokerage.brokerage_commission_enabled !== false;
      const brokerEnabled = brokerage.broker_commission_enabled !== false;
      if (brokerageEnabled && brokerEnabled) {
        const brokerSplit = brokerage.broker_split ?? 0.5;
        brokerCommission = totalCommission * brokerSplit;
        brokerageCommission = totalCommission * (1 - brokerSplit);
      } else if (brokerageEnabled) {
        brokerageCommission = totalCommission;
      } else if (brokerEnabled) {
        brokerCommission = totalCommission;
      }
    } else {
      brokerCommission = totalCommission;
    }

    // Update referral
    await base44.asServiceRole.entities.Referral.update(referral_id, {
      invoice_id: proposal_id,
      status: 'purchased',
      reviewed_date: new Date().toISOString(),
      first_year_revenue: firstYearRevenue,
      commission_rate: commissionRate,
      commission_amount: totalCommission,
      brokerage_commission: brokerageCommission,
      broker_commission: brokerCommission,
    });

    // Activity entry
    if (partner) {
      const companyLabel = referral.company_name || referral.contact_name || 'Referral';
      await base44.asServiceRole.entities.ReferralActivity.create({
        referral_partner_id: partner.id,
        referral_id: referral_id,
        message: `${companyLabel} marked as purchased ($${firstYearRevenue.toLocaleString()})`,
        activity_date: new Date().toISOString(),
      });
    }

    // Best-effort: mark the partner's broker lead as active_partner
    if (partner?.email) {
      try {
        const matchingLeads = await base44.asServiceRole.entities.Lead.filter({ email: partner.email });
        if (matchingLeads.length > 0) {
          await base44.asServiceRole.entities.Lead.update(matchingLeads[0].id, { partner_status: 'active_partner' });
        }
      } catch (e) {
        console.warn('recordReferralPurchase: could not update lead partner_status:', e.message);
      }
    }

    return Response.json({
      success: true,
      referral_id,
      proposal_id,
      first_year_revenue: firstYearRevenue,
      commission_rate: commissionRate,
      commission_amount: totalCommission,
      brokerage_commission: brokerageCommission,
      broker_commission: brokerCommission,
      ytd_revenue: aggregateYtd,
    });
  } catch (error) {
    console.error('recordReferralPurchase error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});