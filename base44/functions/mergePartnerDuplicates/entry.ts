import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';


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

    // Fetch all broker_lead Leads and all ReferralPartners
    const [leads, partners] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }),
      base44.asServiceRole.entities.ReferralPartner.list(),
    ]);

    // Build email -> Lead map (lowercase)
    const leadByEmail = {};
    for (const lead of leads) {
      if (lead.email) leadByEmail[lead.email.toLowerCase()] = lead;
    }

    // Find duplicates: ReferralPartner whose email exists in Leads
    const duplicates = [];
    for (const partner of partners) {
      if (!partner.email) continue;
      const lead = leadByEmail[partner.email.toLowerCase()];
      if (lead) {
        duplicates.push({ lead, partner });
      }
    }

    if (dryRun) {
      return Response.json({
        dryRun: true,
        count: duplicates.filter(({ lead }) => !lead.referral_partner_id).length,
        duplicates: duplicates.map(({ lead, partner }) => ({
          email: lead.email,
          leadId: lead.id,
          leadName: lead.name,
          partnerId: partner.id,
          partnerName: partner.name,
          partnerCompany: partner.company,
          partnerPhone: partner.phone,
          partnerNotes: partner.notes,
          partnerAgreementFileUrl: partner.agreement_file_url,
          partnerAgreementSignedDate: partner.agreement_signed_date,
          partnerCommissionTiers: partner.commission_tiers,
          partnerYtdRevenue: partner.ytd_revenue,
          partnerTotalCommissionsPaid: partner.total_commissions_paid,
          partnerPortalId: partner.unique_portal_id,
          partnerIsActive: partner.is_active,
          partnerReferralCount: partner.referral_count,
          alreadyLinked: !!lead.referral_partner_id,
        })),
      });
    }

    // Fetch all referrals with explicit high limit so counts are accurate.
    const allReferrals = await base44.asServiceRole.entities.Referral.list('-created_date', 2000);

    // Non-destructive merge: copy unique ReferralPartner fields onto the Lead, but
    // never delete the ReferralPartner record — deleting it would break the partner's
    // live portal URL and orphan every Referral that points at it.
    // Idempotent: if lead.referral_partner_id is already set or notes already contains
    // the marker, we skip the notes append so it doesn't grow on every run.
    const merged = [];
    const errors = [];
    const warnings = [];
    const skipped = [];

    for (const { lead, partner } of duplicates) {
      try {
        // Skip if already cross-referenced — idempotent.
        if (lead.referral_partner_id) {
          skipped.push({ email: lead.email, leadId: lead.id, partnerId: partner.id, reason: 'already_linked' });
          continue;
        }

        const referralCount = allReferrals.filter(r => r.referral_partner_id === partner.id).length;

        // Build update payload: only copy fields that are missing/empty on the Lead
        const updates = { referral_partner_id: partner.id };
        if (!lead.company && partner.company) updates.company = partner.company;
        if (!lead.phone && partner.phone) updates.phone = partner.phone;
        if (!lead.notes && partner.notes) updates.notes = partner.notes;

        // Store agreement info in notes — one-time only (guarded by marker check).
        const alreadyHasMarker = (lead.notes || '').includes('[Merged from ReferralPartner]');
        if (!alreadyHasMarker) {
          const agreementParts = [];
          if (partner.agreement_file_url) agreementParts.push(`Agreement URL: ${partner.agreement_file_url}`);
          if (partner.agreement_signed_date) agreementParts.push(`Agreement signed: ${partner.agreement_signed_date}`);
          if (partner.unique_portal_id) agreementParts.push(`Portal ID: ${partner.unique_portal_id}`);
          if (partner.commission_tiers?.length) agreementParts.push(`Commission tiers: ${JSON.stringify(partner.commission_tiers)}`);
          if (partner.ytd_revenue) agreementParts.push(`YTD revenue: $${partner.ytd_revenue}`);
          if (partner.total_commissions_paid) agreementParts.push(`Total commissions paid: $${partner.total_commissions_paid}`);

          if (agreementParts.length > 0) {
            const appendText = `\n\n[Merged from ReferralPartner]\n${agreementParts.join('\n')}`;
            updates.notes = (lead.notes || '') + appendText;
          }
        }

        // Promote partner_status to active_partner if partner was active
        if (partner.is_active && lead.partner_status !== 'active_partner') {
          updates.partner_status = 'active_partner';
        }

        // Copy referral_count if partner has a higher one
        if ((partner.referral_count || 0) > (lead.referral_count || 0)) {
          updates.referral_count = partner.referral_count;
        }

        await base44.asServiceRole.entities.Lead.update(lead.id, updates);

        // ReferralPartner record is intentionally left intact to preserve the
        // live portal URL and existing Referral foreign keys.

        warnings.push({
          partnerId: partner.id,
          partnerName: partner.name,
          referralCount,
        });

        merged.push({ email: lead.email, leadId: lead.id, partnerId: partner.id });
      } catch (err) {
        errors.push({ email: lead.email, error: err.message });
      }
    }

    return Response.json({ dryRun: false, merged: merged.length, skipped: skipped.length, warnings, errors, details: merged, skippedDetails: skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});