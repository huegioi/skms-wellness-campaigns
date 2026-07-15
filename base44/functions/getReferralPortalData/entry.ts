import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

  // Get all referrals for this partner only
  const referrals = await base44.asServiceRole.entities.Referral.filter({ referral_partner_id: partner.id });

  // Get the 15 most recent activities for the partner's in-portal feed
  const activities = await base44.asServiceRole.entities.ReferralActivity.filter({ referral_partner_id: partner.id }, '-activity_date', 15);

  // ─── DATA PRIVACY: Only return clients explicitly referred by this partner ───
  // Clients are linked via referral_partner_id on the Client record.
  const ownedClients = await base44.asServiceRole.entities.Client.filter({ referral_partner_id: partner.id }, '-created_date', 500);

  // Build a set of owned client IDs for all sub-queries
  const ownedClientIdSet = new Set(ownedClients.map(c => c.id));

  // Show ALL linked clients regardless of whether they have feedback yet
  // Use company name if available, fall back to client name
  const clientCompanies = ownedClients
    .filter(c => c.company || c.name)
    .map(c => ({ id: c.id, company: c.company || c.name, name: c.name, email: c.email }));

  // Deduplicate by company name, keeping first match
  const seen = new Set();
  const uniqueClientCompanies = clientCompanies.filter(c => {
    if (seen.has(c.company)) return false;
    seen.add(c.company);
    return true;
  }).sort((a, b) => a.company.localeCompare(b.company));

  // Get proposals ONLY for this partner's owned clients — server-side filtered per client
  const proposalResults = await Promise.all(
    ownedClients.map(c => base44.asServiceRole.entities.Proposal.filter({ client_id: c.id }, '-created_date'))
  );
  const partnerProposals = proposalResults.flat();

  // Build proposal revenue map: client_id → ACCEPTED proposals only
  const proposalRevenueByClient = {};
  partnerProposals.forEach(p => {
    if (!p.client_id) return;
    if (p.status !== 'accepted') return; // strictly accepted/signed proposals only
    if (!proposalRevenueByClient[p.client_id]) proposalRevenueByClient[p.client_id] = 0;
    proposalRevenueByClient[p.client_id] += p.total_amount || 0;
  });

  // Calculate commission summary
  const currentYear = new Date().getFullYear();
  const tiers = partner.commission_tiers || [];

  // Sort referrals by date
  referrals.sort((a, b) => new Date(b.referral_date) - new Date(a.referral_date));

  // Compute ytd revenue from referrals
  const ytdReferrals = referrals.filter(r => new Date(r.referral_date).getFullYear() === currentYear);
  const ytdRevenue = ytdReferrals.reduce((sum, r) => sum + (r.first_year_revenue || 0), 0);

  // Determine current commission tier
  const currentTier = tiers
    .filter(t => ytdRevenue >= t.min_revenue)
    .sort((a, b) => b.min_revenue - a.min_revenue)[0] || null;

  // Base commission from referral records (admin-confirmed)
  const referralCommission = referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const totalCommissionPaid = partner.total_commissions_paid || 0;
  // Will be recalculated after ledger is built to include proposal-based entries
  let totalCommissionEarned = referralCommission;
  let commissionPending = totalCommissionEarned - totalCommissionPaid;

  // ─── Per-client commission ledger ───
  // Build a map from client_id → client record for enrichment
  const clientById = {};
  ownedClients.forEach(c => { clientById[c.id] = c; });

  // Group referrals by referred_client_id (or company_name as fallback)
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
    ledgerMap[key].commission_earned += r.commission_amount || 0;
    // Use most recent status
    if (r.referral_date > ledgerMap[key].referral_date) {
      ledgerMap[key].status = r.status;
      ledgerMap[key].referral_date = r.referral_date;
    }
  });

  // Also include ALL linked clients, using proposal revenue or QB invoices as revenue source
  ownedClients.forEach(c => {
    const alreadyInLedger = Object.values(ledgerMap).some(l => l.client_id === c.id);
    const rate = currentTier ? currentTier.rate : (tiers[0]?.rate || 0.10);
    // Revenue priority: QB invoices > proposals > 0
    const revenue = (c.total_invoice_value > 0)
      ? c.total_invoice_value
      : (proposalRevenueByClient[c.id] || 0);

    if (alreadyInLedger) {
      // Enrich existing ledger row with proposal revenue if first_year_revenue is 0
      const key = Object.keys(ledgerMap).find(k => ledgerMap[k].client_id === c.id);
      if (key && ledgerMap[key].first_year_revenue === 0 && revenue > 0) {
        ledgerMap[key].first_year_revenue = revenue;
        ledgerMap[key].commission_earned = revenue * (ledgerMap[key].commission_rate || rate);
        ledgerMap[key].commission_rate = ledgerMap[key].commission_rate || rate;
      }
    } else {
      // Always add all linked clients to the ledger, even if revenue is 0
      ledgerMap[c.id] = {
        client_id: c.id,
        company: c.company || c.name,
        first_year_revenue: revenue,
        commission_earned: revenue * rate,
        commission_rate: rate,
        status: 'converted_to_client',
        referral_date: c.created_date,
        invoice_id: null,
      };
    }
  });

  const commissionLedger = Object.values(ledgerMap)
    .sort((a, b) => (b.commission_earned - a.commission_earned));

  // Recalculate totals from the full ledger (includes proposal-enriched rows)
  totalCommissionEarned = commissionLedger.reduce((s, r) => s + (r.commission_earned || 0), 0);
  // Pending = earned but NOT yet paid out (admin marks paid via total_commissions_paid on the partner record)
  // Total Earned = all-time commissions accrued (paid + unpaid)
  // Pending / Unpaid = earned minus what's already been paid
  commissionPending = Math.max(0, totalCommissionEarned - totalCommissionPaid);

  const commissionsEnabled = partner.commissions_enabled !== false;

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
    },
    referrals: commissionsEnabled
      ? referrals
      : referrals.map(r => {
          const { commission_amount, commission_rate, ...rest } = r;
          return rest;
        }),
    client_companies: uniqueClientCompanies,
    partner_proposals: partnerProposals,
    activities: activities.map(a => ({
      id: a.id,
      message: a.message,
      activity_date: a.activity_date
    })),
  };

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