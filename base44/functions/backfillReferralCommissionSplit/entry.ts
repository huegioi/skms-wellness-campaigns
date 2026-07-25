import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time backfill: populate broker_commission / brokerage_commission on historical
 * Referrals that have commission_amount > 0 but null broker_commission (records created
 * before the split fields existed).
 *
 * dryRun defaults to true — shows a report grouped by partner without writing anything.
 * Sets Referral.split_backfilled = true on every touched record so this can never double-apply.
 */
const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { dryRun = true } = body;

    // Fetch all referrals and partners (read-only, high limit).
    const [allReferrals, allPartners] = await Promise.all([
      base44.asServiceRole.entities.Referral.list('-created_date', 2000),
      base44.asServiceRole.entities.ReferralPartner.list('-created_date', 2000),
    ]);

    const partnerById = {};
    for (const p of allPartners) partnerById[p.id] = p;

    // Also fetch all brokerages for brokerage lookups.
    const allBrokerages = await base44.asServiceRole.entities.Brokerage.list('-created_date', 500);
    const brokerageById = {};
    for (const b of allBrokerages) brokerageById[b.id] = b;

    // Target: referrals with commission_amount > 0, null broker_commission, not already backfilled.
    const targets = allReferrals.filter(r =>
      (r.commission_amount || 0) > 0 &&
      r.broker_commission == null &&
      !r.split_backfilled
    );

    // Group by partner for the report.
    const byPartner = {}; // partnerId -> { partnerName, partnerEmail, brokerageName, referrals: [...] }
    for (const r of targets) {
      const partner = r.referral_partner_id ? partnerById[r.referral_partner_id] : null;
      const brokerage = partner?.brokerage_id ? brokerageById[partner.brokerage_id] : null;
      const key = r.referral_partner_id || '_no_partner';

      if (!byPartner[key]) {
        byPartner[key] = {
          partnerId: r.referral_partner_id || null,
          partnerName: partner?.name || r.referral_partner_name || 'Unknown',
          partnerEmail: partner?.email || null,
          brokerageId: partner?.brokerage_id || null,
          brokerageName: brokerage?.name || null,
          referrals: [],
        };
      }

      // Compute the split for this referral.
      let brokerCommission = 0;
      let brokerageCommission = 0;
      const totalCommission = r.commission_amount;

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
        // Solo partner: all to broker.
        brokerCommission = totalCommission;
      }

      byPartner[key].referrals.push({
        referralId: r.id,
        contactName: r.contact_name,
        companyName: r.company_name,
        status: r.status,
        commissionAmount: totalCommission,
        brokerCommission,
        brokerageCommission,
      });
    }

    const report = Object.values(byPartner).map(g => ({
      ...g,
      referralCount: g.referrals.length,
      totalBrokerCommission: g.referrals.reduce((s, r) => s + r.brokerCommission, 0),
      totalBrokerageCommission: g.referrals.reduce((s, r) => s + r.brokerageCommission, 0),
    }));

    if (dryRun) {
      return Response.json({
        dryRun: true,
        total_targets: targets.length,
        partners_affected: report.length,
        partners: report,
      });
    }

    // Apply the backfill.
    let updated = 0;
    const errors = [];
    for (const r of targets) {
      try {
        const partner = r.referral_partner_id ? partnerById[r.referral_partner_id] : null;
        const brokerage = partner?.brokerage_id ? brokerageById[partner.brokerage_id] : null;
        const totalCommission = r.commission_amount;

        let brokerCommission = 0;
        let brokerageCommission = 0;

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

        await base44.asServiceRole.entities.Referral.update(r.id, {
          broker_commission: brokerCommission,
          brokerage_commission: brokerageCommission,
          split_backfilled: true,
        });
        updated += 1;
      } catch (err) {
        errors.push({ referralId: r.id, error: err.message });
      }
    }

    return Response.json({
      dryRun: false,
      updated,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});