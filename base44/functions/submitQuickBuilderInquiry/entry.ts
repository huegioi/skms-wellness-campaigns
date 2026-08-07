import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { company_name, contact_name, email, team_size, goals, selected_service_ids, wants_wellness_boxes, ref, estimated_investment, matched_stage,
            headcount, company_size_band, selected_tier, is_new_client, is_returning_client, discount_applied } = body;

    // ── Validate required fields ──
    if (!company_name || !contact_name || !email || !team_size) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // ── Rate limit: reject if same email submitted in the past hour ──
    const recentLeads = await base44.asServiceRole.entities.Lead.filter(
      { email: normalizedEmail, is_archived: { $ne: true } },
      '-created_date',
      1
    );
    if (recentLeads.length > 0) {
      const lastSubmission = new Date(recentLeads[0].created_date);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastSubmission > oneHourAgo) {
        return Response.json(
          { error: 'rate_limited', message: 'You have already submitted recently. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // ── Look up service names for the notes ──
    const allServices = await base44.asServiceRole.entities.Service.list();
    const serviceMap = {};
    allServices.forEach(s => { serviceMap[s.id] = s.name; });
    const serviceIds = Array.isArray(selected_service_ids) ? selected_service_ids : [];
    const serviceNames = serviceIds.map(id => serviceMap[id] || id);

    // ── Build notes ──
    const notesLines = [];
    if (headcount != null) {
      notesLines.push(`Headcount: ${Number(headcount).toLocaleString()} employees${company_size_band ? ` (${company_size_band})` : ''}`);
    }
    if (goals && goals.length > 0) {
      notesLines.push(`Goals: ${goals.join(', ')}`);
    }
    if (serviceNames.length > 0) {
      notesLines.push(`Selected services:\n${serviceNames.map(n => `- ${n}`).join('\n')}`);
    }
    notesLines.push(`Wellness boxes: ${wants_wellness_boxes ? 'yes' : 'no'}`);
    if (selected_tier) notesLines.push(`Tier chosen: ${selected_tier}`);
    if (matched_stage && matched_stage !== selected_tier) notesLines.push(`Matched stage: ${matched_stage}`);
    if (is_new_client) notesLines.push('First-time client — $300 welcome discount applied');
    if (is_returning_client) notesLines.push('Returning client — $300 materials credit applied');
    if (discount_applied) notesLines.push(`Total discount applied: $${Number(discount_applied).toLocaleString()}`);
    if (estimated_investment != null) notesLines.push(`Estimated investment: $${estimated_investment.toLocaleString()}`);
    const notes = notesLines.join('\n\n');

    // ── Build source ──
    const source = ref ? `Quick Builder (${ref})` : 'Quick Builder';

    // ── Create Lead ──
    const lead = await base44.asServiceRole.entities.Lead.create({
      name: contact_name,
      email: normalizedEmail,
      company: company_name,
      company_size: team_size,
      lead_type: 'company_inquiry',
      status: 'cold',
      source,
      notes,
      quickbuilder_selections: serviceIds,
      estimated_investment: estimated_investment || undefined,
      matched_stage: matched_stage || undefined,
    });

    // ── If ref matches a ReferralPartner's unique_portal_id, create a pending_review Referral ──
    // Reuses createReferral logic: links to the lead above, logs activity for the partner feed.
    let referral_created = false;
    if (ref) {
      const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: ref });
      if (partners && partners.length > 0) {
        const partner = partners[0];

        // Duplicate guard: same email + partner within 30 days
        const recentReferrals = await base44.asServiceRole.entities.Referral.filter(
          { referral_partner_id: partner.id },
          '-referral_date',
          50
        );
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const isDuplicate = recentReferrals.some(r => {
          if (!r.referral_date) return false;
          const emailMatch = (r.contact_email || '').toLowerCase().trim() === normalizedEmail;
          return emailMatch && new Date(r.referral_date).getTime() > thirtyDaysAgo;
        });

        if (!isDuplicate) {
          const referral = await base44.asServiceRole.entities.Referral.create({
            referral_partner_id: partner.id,
            referral_partner_name: partner.name,
            referred_lead_id: lead.id,
            contact_name,
            contact_email: normalizedEmail,
            company_name,
            notes,
            referral_date: new Date().toISOString(),
            status: 'pending_review'
          });

          const displayName = company_name || contact_name;
          await base44.asServiceRole.entities.ReferralActivity.create({
            referral_partner_id: partner.id,
            referral_id: referral.id,
            message: `New referral submitted: ${displayName}`,
            activity_date: new Date().toISOString()
          });
          referral_created = true;
        }
      }
    }

    return Response.json({ success: true, referral_created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});