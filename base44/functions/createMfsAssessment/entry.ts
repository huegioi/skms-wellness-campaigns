import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getOrgDomain, deriveCompanyFromEmail } from '../../shared/emailDomain.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { company_name, contact_name, email, employee_count, industry, goals, ref } = body;

    // ── Validate required fields ──
    if (!company_name || !contact_name || !email || !employee_count) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const appUrl = new URL(req.url).origin;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // ── Dedupe: same email within 30 days → return existing links ──
    const existingByEmail = await base44.asServiceRole.entities.MfsAssessment.filter(
      { contact_email: normalizedEmail },
      '-created_date',
      5
    );
    const emailMatch = existingByEmail.find(a => new Date(a.created_date).getTime() > thirtyDaysAgo);
    if (emailMatch) {
      return Response.json({
        success: true,
        duplicate: true,
        employee_link: `${appUrl}/MfsSurvey?t=${emailMatch.token}`,
        dashboard_link: `${appUrl}/MfsResults?t=${emailMatch.token}`,
      });
    }

    // ── Dedupe: same company within 30 days → return existing links ──
    if (company_name) {
      const existingByCompany = await base44.asServiceRole.entities.MfsAssessment.filter(
        { company_name },
        '-created_date',
        5
      );
      const companyMatch = existingByCompany.find(a => new Date(a.created_date).getTime() > thirtyDaysAgo);
      if (companyMatch) {
        return Response.json({
          success: true,
          duplicate: true,
          employee_link: `${appUrl}/MfsSurvey?t=${companyMatch.token}`,
          dashboard_link: `${appUrl}/MfsResults?t=${companyMatch.token}`,
        });
      }
    }

    // ── Rate limit: reject if same email submitted in the past hour ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (existingByEmail.length > 0 && new Date(existingByEmail[0].created_date) > oneHourAgo) {
      return Response.json(
        { error: 'rate_limited', message: 'You have already submitted recently. Please try again later.' },
        { status: 429 }
      );
    }

    const token = crypto.randomUUID();

    // ── Create Client (is_assessment_lead, event_follow_up, tagged MFS) ──
    // Derive company from email domain if not provided — never leave it empty.
    const resolvedCompany = company_name || deriveCompanyFromEmail(normalizedEmail) || 'Unknown Company';
    const client = await base44.asServiceRole.entities.Client.create({
      name: contact_name,
      email: normalizedEmail,
      email_domain: getOrgDomain(normalizedEmail),
      company: resolvedCompany,
      company_size: employee_count,
      industry: industry || undefined,
      is_assessment_lead: true,
      client_stage: 'event_follow_up',
      portal_token: crypto.randomUUID(),
      tags: ['MFS'],
    });

    // ── Create Lead (company_inquiry, source "Mental Fitness Score" + ref) ──
    const source = ref ? `Mental Fitness Score (${ref})` : 'Mental Fitness Score';
    const lead = await base44.asServiceRole.entities.Lead.create({
      name: contact_name,
      email: normalizedEmail,
      company: company_name,
      company_size: employee_count,
      industry: industry || undefined,
      lead_type: 'company_inquiry',
      status: 'cold',
      source,
      converted_client_id: client.id,
      notes: goals && goals.length > 0 ? `Goals: ${goals.join(', ')}` : undefined,
    });

    // ── Create MfsAssessment ──
    const assessment = await base44.asServiceRole.entities.MfsAssessment.create({
      client_id: client.id,
      lead_id: lead.id,
      token,
      status: 'collecting',
      company_name,
      contact_name,
      contact_email: normalizedEmail,
      employee_count,
      industry: industry || undefined,
      goals: goals || [],
      ref: ref || undefined,
    });

    // ── If ref matches a ReferralPartner's portal id, create a pending_review Referral ──
    let referral_created = false;
    if (ref) {
      const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: ref });
      if (partners && partners.length > 0) {
        const partner = partners[0];
        const recentReferrals = await base44.asServiceRole.entities.Referral.filter(
          { referral_partner_id: partner.id },
          '-referral_date',
          50
        );
        const isDup = recentReferrals.some(r => {
          if (!r.referral_date) return false;
          return (r.contact_email || '').toLowerCase().trim() === normalizedEmail &&
                 new Date(r.referral_date).getTime() > thirtyDaysAgo;
        });

        if (!isDup) {
          const referral = await base44.asServiceRole.entities.Referral.create({
            referral_partner_id: partner.id,
            referral_partner_name: partner.name,
            referred_lead_id: lead.id,
            contact_name,
            contact_email: normalizedEmail,
            company_name,
            notes: goals && goals.length > 0 ? `Goals: ${goals.join(', ')}` : undefined,
            referral_date: new Date().toISOString(),
            status: 'pending_review'
          });
          await base44.asServiceRole.entities.ReferralActivity.create({
            referral_partner_id: partner.id,
            referral_id: referral.id,
            message: `New MFS referral: ${company_name || contact_name}`,
            activity_date: new Date().toISOString()
          });
          referral_created = true;
        }
      }
    }

    return Response.json({
      success: true,
      duplicate: false,
      employee_link: `${appUrl}/MfsSurvey?t=${token}`,
      dashboard_link: `${appUrl}/MfsResults?t=${token}`,
      referral_created,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});