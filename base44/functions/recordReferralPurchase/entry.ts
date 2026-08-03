import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Hardcoded fallback for wellness box prices — used only if a Service record is missing or has no price
const FALLBACK_BOX_PRICES = {
  reduceStress: 65, relaxationSleep: 65, largeEmotional: 100,
  largeStressReduction: 120, stressReductionDigital: 50,
  beyondBurnoutDigital: 100, emotionalWellness: 100,
  wintertimeHealthy: 100, newYearFreshStart: 100
};

// Maps wellness box code keys to Service record names for price lookup
const BOX_KEY_TO_SERVICE_NAME = {
  reduceStress: 'Reduce Stress Wellness Box',
  relaxationSleep: 'Relaxation & Sleep Wellness Box',
  largeEmotional: 'Large Emotional Wellness Box',
  largeStressReduction: 'Large Stress Reduction Wellness Box',
  stressReductionDigital: 'Stress Reduction Digital Wellness Box',
  beyondBurnoutDigital: 'Beyond Burnout Digital Wellness Box',
  emotionalWellness: 'Emotional Wellness Box',
  wintertimeHealthy: 'Wintertime Stay Healthy Box',
  newYearFreshStart: 'New Year Fresh Start Box',
};

// Digital vs physical box floors — mirror of base44/shared/wellnessBoxes.ts
const DIGITAL_BOX_KEYS = ['stressReductionDigital', 'beyondBurnoutDigital'];
const MIN_PHYSICAL_BOX_PRICE = 65;
const MIN_DIGITAL_BOX_PRICE = 50;
function isDigitalBox(key) { return DIGITAL_BOX_KEYS.includes(key); }
function boxPriceFloor(key) { return isDigitalBox(key) ? MIN_DIGITAL_BOX_PRICE : MIN_PHYSICAL_BOX_PRICE; }
function applyBoxFloor(key, price) { return Math.max(Number(price) || 0, boxPriceFloor(key)); }

// Wellness box items count at 50% when computing first-year revenue (deliberate policy)
function calcAdjustedRevenue(proposal, servicePriceMap, boxServicePrices, fallbacksUsed) {
  if (!proposal) return 0;
  const s = proposal.selections || {};
  const overrides = s.priceOverrides || {};
  const customCharges = s.customCharges || [];

  let nonBoxTotal = 0;
  const challengePrice = s.challengePrice || 0;

  // Workshops: priceOverrides → workshopsData.price → Service.price → 0
  (s.workshops || []).forEach(id => {
    let price = overrides[id];
    if (price === undefined) {
      const dataEntry = (s.workshopsData || []).find(x => x.id === id);
      if (dataEntry && dataEntry.price > 0) {
        price = dataEntry.price;
      } else {
        const svcPrice = servicePriceMap.get(id);
        price = (svcPrice && svcPrice > 0) ? svcPrice : 0;
      }
    }
    nonBoxTotal += price;
  });

  // Challenge programs: keep existing ?? challengePrice fallback (already works)
  (s.challengePrograms || []).forEach(id => {
    nonBoxTotal += (overrides[id] ?? challengePrice);
  });

  // Leadership: priceOverrides → leadershipData.price → Service.price → 0
  (s.leadership || []).forEach(id => {
    let price = overrides[id];
    if (price === undefined) {
      const dataEntry = (s.leadershipData || []).find(x => x.id === id);
      if (dataEntry && dataEntry.price > 0) {
        price = dataEntry.price;
      } else {
        const svcPrice = servicePriceMap.get(id);
        price = (svcPrice && svcPrice > 0) ? svcPrice : 0;
      }
    }
    nonBoxTotal += price;
  });

  // Movement classes: priceOverrides → movementClassesData.price → Service.price → 0
  (s.movementClasses || []).forEach(id => {
    let price = overrides[id];
    if (price === undefined) {
      const dataEntry = (s.movementClassesData || []).find(x => x.id === id);
      if (dataEntry && dataEntry.price > 0) {
        price = dataEntry.price;
      } else {
        const svcPrice = servicePriceMap.get(id);
        price = (svcPrice && svcPrice > 0) ? svcPrice : 0;
      }
    }
    nonBoxTotal += price;
  });

  customCharges.forEach(c => nonBoxTotal += (c.amount || 0));

  // Box prices: proposal snapshot → live Service price → FALLBACK_BOX_PRICES → 0
  const boxSnapshot = s.sampleBoxPrices || {};
  let boxTotal = 0;
  const boxQtys = s.sampleBoxQuantities || {};
  Object.entries(boxQtys).forEach(([key, qty]) => {
    if (!qty) return;
    let price;
    let source;
    if (boxSnapshot[key] != null) {
      price = applyBoxFloor(key, boxSnapshot[key]);
      source = 'proposal_snapshot';
    } else if (boxServicePrices[key] != null) {
      price = applyBoxFloor(key, boxServicePrices[key]);
      source = 'service_record';
    } else {
      price = applyBoxFloor(key, FALLBACK_BOX_PRICES[key] || 0);
      source = 'fallback_constant';
      fallbacksUsed.push({ box_key: key, reason: 'Service record missing or no price', fallback_price: price });
    }
    boxTotal += (qty || 0) * price;
  });

  const customBoxQty = s.customBoxQuantity || 0;
  const customBoxItems = s.customBoxItems || [];
  if (customBoxQty > 0 && customBoxItems.length > 0) {
    const unitPrice = Math.max(customBoxItems.reduce((sum, item) => sum + (item.price || 0), 0), 65);
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

    // ── Build Service price lookup maps for calcAdjustedRevenue ──
    const allServices = await base44.asServiceRole.entities.Service.list('name', 500);
    const servicePriceMap = new Map(allServices.map(svc => [svc.id, svc.price]));

    // Build box price map from wellness_box Services matched by name
    const boxServicePrices = {};
    for (const [key, name] of Object.entries(BOX_KEY_TO_SERVICE_NAME)) {
      const svc = allServices.find(svc => svc.category === 'wellness_box' && svc.name === name);
      if (svc && typeof svc.price === 'number') {
        boxServicePrices[key] = svc.price;
      }
    }

    const fallbacksUsed = [];
    const firstYearRevenue = calcAdjustedRevenue(proposal, servicePriceMap, boxServicePrices, fallbacksUsed);
    if (fallbacksUsed.length > 0) {
      console.warn('recordReferralPurchase: box price fallbacks used:', JSON.stringify(fallbacksUsed));
    }

    // Fetch partner (with fallback for deleted records)
    let partner = null;
    if (referral.referral_partner_id) {
      try { partner = await base44.asServiceRole.entities.ReferralPartner.get(referral.referral_partner_id); }
      catch { partner = null; }
    }

    // ─── Hard guard: demo revenue must never influence a real broker's tier ───
    const isDemoReferral = referral.is_demo === true;
    const isDemoPartner = partner?.is_demo === true;

    // Update partner YTD first (needed for brokerage aggregate computation)
    // Demo referrals do not inflate real partner YTD
    const partnerYtdRevenue = (isDemoReferral || isDemoPartner)
      ? (partner?.ytd_revenue || 0)
      : (partner?.ytd_revenue || 0) + firstYearRevenue;
    if (firstYearRevenue > 0 && partner && !isDemoReferral && !isDemoPartner) {
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
        const matchingLeads = await base44.asServiceRole.entities.Lead.filter({ email: partner.email, is_archived: { $ne: true } });
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