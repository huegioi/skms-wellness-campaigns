import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';


const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Team only' }, { status: 403 });

    const allReferrals = await base44.asServiceRole.entities.Referral.list();

    // Group by referred_client_id (non-empty) and by (company_name + partner)
    const byClient = {};
    const byCompanyPartner = {};

    for (const r of allReferrals) {
      if (r.referred_client_id) {
        if (!byClient[r.referred_client_id]) byClient[r.referred_client_id] = [];
        byClient[r.referred_client_id].push(r);
      }
      if (r.company_name && r.referral_partner_id) {
        const key = `${r.company_name.toLowerCase().trim()}::${r.referral_partner_id}`;
        if (!byCompanyPartner[key]) byCompanyPartner[key] = [];
        byCompanyPartner[key].push(r);
      }
    }

    const project = (r) => ({
      id: r.id,
      company_name: r.company_name,
      contact_name: r.contact_name,
      contact_email: r.contact_email,
      referral_partner_id: r.referral_partner_id,
      referral_partner_name: r.referral_partner_name,
      referred_client_id: r.referred_client_id,
      status: r.status,
      referral_date: r.referral_date,
      first_year_revenue: r.first_year_revenue,
      commission_amount: r.commission_amount,
      invoice_id: r.invoice_id,
    });

    const groups = [];
    const seen = new Set();

    // Duplicates sharing the same referred_client_id
    for (const [clientId, refs] of Object.entries(byClient)) {
      if (refs.length > 1) {
        for (const r of refs) seen.add(r.id);
        groups.push({ match_type: 'referred_client_id', match_key: clientId, referrals: refs.map(project) });
      }
    }

    // Duplicates sharing company_name + partner (not already captured above)
    for (const [key, refs] of Object.entries(byCompanyPartner)) {
      const newRefs = refs.filter(r => !seen.has(r.id));
      if (newRefs.length > 1) {
        for (const r of newRefs) seen.add(r.id);
        groups.push({ match_type: 'company_name + partner', match_key: key.replace('::', ' / '), referrals: newRefs.map(project) });
      }
    }

    return Response.json({
      total_referrals: allReferrals.length,
      duplicate_groups_count: groups.length,
      duplicate_groups: groups,
    });
  } catch (error) {
    console.error('referralDedupeReport error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});