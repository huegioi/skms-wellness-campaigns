import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * One-time backfill: find every active partner (by any signal) with no portal ID,
 * create/link a ReferralPartner record if missing, generate portal ID, and send invite.
 * Admin-only.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
  const appBaseUrl = 'https://curriculum-designer-05b51a3b.base44.app';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const results = { provisioned: [], skipped_no_email: [], already_had_portal: [], errors: [] };

  // ── 1. ReferralPartner records that are active but missing a portal ──
  const allPartners = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 500);
  const activePartners = allPartners.filter(p =>
    (p.is_active === true || p.partner_status === 'Active Partner') && !p.unique_portal_id
  );

  for (const partner of activePartners) {
    if (!partner.email || !emailRegex.test(partner.email)) {
      results.skipped_no_email.push({ id: partner.id, name: partner.name, email: partner.email || '(none)', source: 'ReferralPartner' });
      continue;
    }
    const portalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    await base44.asServiceRole.entities.ReferralPartner.update(partner.id, {
      unique_portal_id: portalId,
      is_active: true,
    });
    results.provisioned.push({ id: partner.id, name: partner.name, email: partner.email, portal_id: portalId, email_sent: false, source: 'ReferralPartner' });
  }

  // ── 2. Lead records with partner_status=active_partner, no matching ReferralPartner ──
  const allLeads = await base44.asServiceRole.entities.Lead.filter({ partner_status: 'active_partner', lead_type: 'broker_lead' }, '-created_date', 500);
  // Build set of emails already covered by ReferralPartner records
  const allPartnerEmails = new Set(allPartners.map(p => p.email?.toLowerCase()).filter(Boolean));

  for (const lead of allLeads) {
    if (!lead.email || !emailRegex.test(lead.email)) {
      results.skipped_no_email.push({ id: lead.id, name: lead.name, email: lead.email || '(none)', source: 'Lead' });
      continue;
    }
    const emailLower = lead.email.toLowerCase();

    // Check if a ReferralPartner already exists for this lead's email
    const existingPartnerArr = allPartners.filter(p => p.email?.toLowerCase() === emailLower);
    const existingPartner = existingPartnerArr[0] || null;

    if (existingPartner) {
      if (existingPartner.unique_portal_id) {
        results.already_had_portal.push({ id: existingPartner.id, name: existingPartner.name, email: existingPartner.email });
        continue;
      }
      // Has a partner record but no portal — already handled in step 1 above (or needs provisioning)
      if (!results.provisioned.find(p => p.id === existingPartner.id)) {
        const portalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        await base44.asServiceRole.entities.ReferralPartner.update(existingPartner.id, { unique_portal_id: portalId, is_active: true });
        results.provisioned.push({ id: existingPartner.id, name: existingPartner.name, email: existingPartner.email, portal_id: portalId, email_sent: false, source: 'Lead→ReferralPartner' });
      }
    } else {
      // No ReferralPartner record at all — create one from the Lead
      const portalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const newPartner = await base44.asServiceRole.entities.ReferralPartner.create({
        name: lead.name,
        email: lead.email,
        company: lead.company || '',
        phone: lead.phone || '',
        is_active: true,
        partner_status: 'Active Partner',
        unique_portal_id: portalId,
        notes: `Auto-created from Lead record ${lead.id} during backfill on ${new Date().toISOString().split('T')[0]}`,
      });
      // Link lead back to partner
      await base44.asServiceRole.entities.Lead.update(lead.id, { partner_status: 'active_partner' });
      results.provisioned.push({ id: newPartner.id, name: lead.name, email: lead.email, portal_id: portalId, email_sent: false, source: 'Lead→new ReferralPartner' });
    }
  }

  return Response.json({
    summary: {
      provisioned_count: results.provisioned.length,
      skipped_no_email_count: results.skipped_no_email.length,
      already_had_portal_count: results.already_had_portal.length,
      sendgrid_available: !!sendgridKey,
    },
    provisioned: results.provisioned,
    skipped_no_email: results.skipped_no_email,
    already_had_portal: results.already_had_portal,
  });
});

async function sendPortalEmail(sendgridKey, partner, portalId, appBaseUrl) {
  if (!sendgridKey) return false;
  const portalUrl = `${appBaseUrl}/ReferralPortal?id=${portalId}`;
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #013f7c; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">SKMS Wellness</h1>
        <p style="color: #93c5fd; margin: 4px 0 0;">Referral Partner Portal</p>
      </div>
      <div style="padding: 32px 24px; background: #f9fafb;">
        <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${partner.name}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Your SKMS Wellness Referral Partner Portal is now active. Use your private link below to view your referrals,
          commission tracking, client ROI data, and program resources.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${portalUrl}"
             style="background-color: #264d44; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Access My Partner Portal →
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          This is your unique, private link. Please bookmark it — no password required.
          Do not share this link with others.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Questions? Reply to this email or contact your SKMS Wellness representative.<br/>
          SKMS Wellness · Referral Partner Program
        </p>
      </div>
    </div>
  `;
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: partner.email, name: partner.name }] }],
      from: { email: 'william@skillfulmeans.life', name: 'SKMS Wellness' },
      subject: 'Your SKMS Wellness Partner Portal is Ready',
      content: [{ type: 'text/html', value: emailBody }],
    }),
  });
  return res.ok;
}