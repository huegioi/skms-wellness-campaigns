import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { shouldExcludeDemo } from '../../shared/demoPortal.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { portal_id } = await req.json();

  if (!portal_id) {
    return Response.json({ error: 'portal_id is required' }, { status: 400 });
  }

  // Authenticate the requesting portal by unique_portal_id token
  const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: portal_id });
  if (!partners || partners.length === 0) {
    return Response.json({ error: 'Partner not found' }, { status: 404 });
  }
  const partner = partners[0];
  // A demo broker's portal shows its demo rows (referrals/clients already flow
  // through — only the brokerage-aggregate query below filtered is_demo).
  const partnerIsDemo = shouldExcludeDemo(partner) === false;
  const referrals = await base44.asServiceRole.entities.Referral.filter({ referral_partner_id: partner.id });

  // Get the 15 most recent activities for the partner's in-portal feed
  const activities = await base44.asServiceRole.entities.ReferralActivity.filter({ referral_partner_id: partner.id }, '-activity_date', 15);

  // ─── DATA PRIVACY: Only return clients explicitly referred by this partner ───
  const ownedClients = await base44.asServiceRole.entities.Client.filter({ referral_partner_id: partner.id }, '-created_date', 500);

  const clientCompanies = ownedClients
    .filter(c => c.company || c.name)
    .map(c => ({ id: c.id, company: c.company || c.name, name: c.name, email: c.email }));

  const seen = new Set();
  const uniqueClientCompanies = clientCompanies.filter(c => {
    if (seen.has(c.company)) return false;
    seen.add(c.company);
    return true;
  }).sort((a, b) => a.company.localeCompare(b.company));

  // Get proposals ONLY for this partner's owned clients
  const proposalResults = await Promise.all(
    ownedClients.map(c => base44.asServiceRole.entities.Proposal.filter({ client_id: c.id }, '-created_date'))
  );
  const partnerProposals = proposalResults.flat();

  const proposalRevenueByClient = {};
  partnerProposals.forEach(p => {
    if (!p.client_id) return;
    if (p.status !== 'accepted') return;
    if (!proposalRevenueByClient[p.client_id]) proposalRevenueByClient[p.client_id] = 0;
    proposalRevenueByClient[p.client_id] += p.total_amount || 0;
  });

  // ─── Brokerage context ───
  let brokerage = null;
  let brokerageAggregateYtd = 0;
  if (partner.brokerage_id) {
    try {
      brokerage = await base44.asServiceRole.entities.Brokerage.get(partner.brokerage_id);
      if (brokerage) {
        const brokeragePartners = await base44.asServiceRole.entities.ReferralPartner.filter(
          partnerIsDemo
            ? { brokerage_id: partner.brokerage_id }
            : { brokerage_id: partner.brokerage_id, is_demo: { $ne: true } },
          '-created_date', 500
        );
        brokerageAggregateYtd = brokeragePartners.reduce((sum, p) => sum + (p.ytd_revenue || 0), 0);
      }
    } catch { brokerage = null; }
  }

  // Determine commission tiers — brokerage tiers if partner belongs to one
  const tiers = brokerage
    ? (brokerage.commission_tiers || [])
    : (partner.commission_tiers || []);

  const currentYear = new Date().getFullYear();

  // Sort referrals by date
  referrals.sort((a, b) => new Date(b.referral_date) - new Date(a.referral_date));

  // Compute YTD revenue — brokerage aggregate or partner's own
  const ytdRevenue = brokerage
    ? brokerageAggregateYtd
    : referrals
        .filter(r => new Date(r.referral_date).getFullYear() === currentYear)
        .reduce((sum, r) => sum + (r.first_year_revenue || 0), 0);

  // Determine current commission tier
  const currentTier = tiers
    .filter(t => ytdRevenue >= (t.min_revenue || 0))
    .sort((a, b) => (b.min_revenue || 0) - (a.min_revenue || 0))[0] || null;

  // ─── Broker commission fraction ───
  // Determines what share of total commission the broker sees in their portal.
  let brokerFraction = 1; // solo partner gets 100%
  if (brokerage) {
    const brokerageEnabled = brokerage.brokerage_commission_enabled !== false;
    const brokerEnabled = brokerage.broker_commission_enabled !== false;
    if (brokerageEnabled && brokerEnabled) {
      brokerFraction = brokerage.broker_split ?? 0.5;
    } else if (brokerEnabled) {
      brokerFraction = 1;
    } else {
      brokerFraction = 0; // brokerage-only or neither
    }
  }

  // Base commission from referral records — use stored broker_commission if available,
  // else compute from commission_amount × brokerFraction
  const referralCommission = referrals.reduce((sum, r) => {
    if (r.broker_commission != null) return sum + r.broker_commission;
    return sum + (r.commission_amount || 0) * brokerFraction;
  }, 0);
  const totalCommissionPaid = partner.total_commissions_paid || 0;
  let totalCommissionEarned = referralCommission;
  let commissionPending = totalCommissionEarned - totalCommissionPaid;

  // ─── Per-client commission ledger ───
  const clientById = {};
  ownedClients.forEach(c => { clientById[c.id] = c; });

  const ledgerMap = {};
  referrals.forEach(r => {
    const key = r.referred_client_id || r.company_name || r.contact_name;
    if (!key) return;
    if (!ledgerMap[key]) {
      const client = r.referred_client_id ? clientById[r.referred_client_id] : null;
      ledgerMap[key] = {
        client_id: r.referred_client_id || null,
        company: client ? (client.company || client.name) : r.company_name || r.contact_name,
        first_year_revenue: 0,
        commission_earned: 0,
        commission_rate: r.commission_rate || null,
        status: r.status,
        referral_date: r.referral_date,
        invoice_id: r.invoice_id || null,
      };
    }
    ledgerMap[key].first_year_revenue += r.first_year_revenue || 0;
    const brokerComm = r.broker_commission != null
      ? r.broker_commission
      : (r.commission_amount || 0) * brokerFraction;
    ledgerMap[key].commission_earned += brokerComm;
    if (r.referral_date > ledgerMap[key].referral_date) {
      ledgerMap[key].status = r.status;
      ledgerMap[key].referral_date = r.referral_date;
    }
  });

  // Also include ALL linked clients
  ownedClients.forEach(c => {
    const alreadyInLedger = Object.values(ledgerMap).some(l => l.client_id === c.id);
    const rate = currentTier ? currentTier.rate : (tiers[0]?.rate || 0.10);
    const revenue = (c.total_invoice_value > 0)
      ? c.total_invoice_value
      : (proposalRevenueByClient[c.id] || 0);

    if (alreadyInLedger) {
      const key = Object.keys(ledgerMap).find(k => ledgerMap[k].client_id === c.id);
      if (key && ledgerMap[key].first_year_revenue === 0 && revenue > 0) {
        ledgerMap[key].first_year_revenue = revenue;
        ledgerMap[key].commission_earned = revenue * (ledgerMap[key].commission_rate || rate) * brokerFraction;
        ledgerMap[key].commission_rate = ledgerMap[key].commission_rate || rate;
      }
    } else {
      ledgerMap[c.id] = {
        client_id: c.id,
        company: c.company || c.name,
        first_year_revenue: revenue,
        commission_earned: revenue * rate * brokerFraction,
        commission_rate: rate,
        status: 'converted_to_client',
        referral_date: c.created_date,
        invoice_id: null,
      };
    }
  });

  const commissionLedger = Object.values(ledgerMap)
    .sort((a, b) => (b.commission_earned - a.commission_earned));

  // Recalculate totals from the full ledger
  totalCommissionEarned = commissionLedger.reduce((s, r) => s + (r.commission_earned || 0), 0);
  commissionPending = Math.max(0, totalCommissionEarned - totalCommissionPaid);

  // Commission visibility: PP2 toggle + broker_commission_enabled (if brokerage)
  const commissionsEnabled = partner.commissions_enabled !== false &&
    (!brokerage || brokerage.broker_commission_enabled !== false);

  // ── Detect MFS-sourced referrals (lead source starts with "Mental Fitness Score") ──
  const mfsLeadIds = referrals.filter(r => r.referred_lead_id).map(r => r.referred_lead_id);
  const mfsLeadResults = await Promise.all(
    mfsLeadIds.map(id =>
      base44.asServiceRole.entities.Lead.filter({ id }).then(r => r[0]).catch(() => null)
    )
  );
  const mfsLeadIdSet = new Set(
    mfsLeadResults.filter(l => l && (l.source || '').startsWith('Mental Fitness Score')).map(l => l.id)
  );
  const referralsWithMfs = referrals.map(r => ({
    ...r,
    is_mfs: !!(r.referred_lead_id && mfsLeadIdSet.has(r.referred_lead_id)),
  }));

  // ── Services (projected, no pricing) for broker portal ROI views ──
  const allServices = await base44.asServiceRole.entities.Service.list('sort_order');
  const portalServices = allServices.map(s => ({
    id: s.id, name: s.name, category: s.category,
    included_assessments: s.included_assessments, sort_order: s.sort_order
  }));

  const response = {
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      company: partner.company,
      agreement_file_url: partner.agreement_file_url,
      agreement_signed_date: partner.agreement_signed_date,
      commission_tiers: commissionsEnabled ? tiers : [],
      is_active: partner.is_active,
      commissions_enabled: commissionsEnabled,
      brokerage_id: partner.brokerage_id || null,
      unique_portal_id: partner.unique_portal_id,
    },
    referrals: commissionsEnabled
      ? referralsWithMfs
      : referralsWithMfs.map(r => {
          const { commission_amount, commission_rate, brokerage_commission, broker_commission, ...rest } = r;
          return rest;
        }),
    client_companies: uniqueClientCompanies,
    partner_proposals: partnerProposals,
    activities: activities.map(a => ({
      id: a.id,
      message: a.message,
      activity_date: a.activity_date
    })),
    services: portalServices,
  };

  if (brokerage) {
    response.brokerage = {
      name: brokerage.name,
      company: brokerage.company,
      aggregate_ytd_revenue: brokerageAggregateYtd,
      brokerage_commission_enabled: brokerage.brokerage_commission_enabled !== false,
      broker_commission_enabled: brokerage.broker_commission_enabled !== false,
      broker_split: brokerage.broker_split ?? 0.5,
    };
  }

  if (commissionsEnabled) {
    response.commission_summary = {
      ytd_revenue: ytdRevenue,
      current_tier: currentTier,
      total_earned: totalCommissionEarned,
      total_paid: totalCommissionPaid,
      pending: commissionPending
    };
    response.commission_ledger = commissionLedger;
  }

  return Response.json(response);
});