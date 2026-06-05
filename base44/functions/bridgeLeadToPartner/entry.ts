import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fires when a Lead entity is updated.
 * If partner_status just changed to 'active_partner', upsert a matching
 * ReferralPartner record by email, generate a portal ID if needed, and
 * send the portal access email.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const { event, data: lead, old_data, send_email = false } = body;

  // Only act when partner_status just became 'active_partner'
  const justActivated =
    lead?.partner_status === 'active_partner' &&
    old_data?.partner_status !== 'active_partner';

  if (!justActivated) {
    return Response.json({ skipped: true, reason: 'No partner_status→active_partner transition' });
  }

  // Only bridge broker_lead types
  if (lead.lead_type !== 'broker_lead') {
    return Response.json({ skipped: true, reason: 'Not a broker_lead' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!lead.email || !emailRegex.test(lead.email)) {
    return Response.json({ skipped: true, reason: 'Lead has no valid email' });
  }

  const emailLower = lead.email.toLowerCase();
  const appBaseUrl = 'https://curriculum-designer-05b51a3b.base44.app';
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');

  // Find existing ReferralPartner by email
  const allPartners = await base44.asServiceRole.entities.ReferralPartner.list('-created_date', 500);
  const existing = allPartners.find(p => p.email?.toLowerCase() === emailLower);

  let partner;
  let portalId;
  let wasCreated = false;

  if (existing) {
    partner = existing;
    if (!existing.unique_portal_id) {
      // Has partner record but no portal — generate one
      portalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      await base44.asServiceRole.entities.ReferralPartner.update(existing.id, {
        unique_portal_id: portalId,
        is_active: true,
        partner_status: 'Active Partner',
      });
      partner = { ...existing, unique_portal_id: portalId };
    } else {
      // Already has portal — just ensure is_active is set
      portalId = existing.unique_portal_id;
      if (!existing.is_active || existing.partner_status !== 'Active Partner') {
        await base44.asServiceRole.entities.ReferralPartner.update(existing.id, {
          is_active: true,
          partner_status: 'Active Partner',
        });
      }
      return Response.json({
        skipped: false,
        action: 'already_provisioned',
        partner_id: existing.id,
        portal_id: portalId,
        email_sent: false,
        note: 'Partner already had a portal — marked active, no duplicate email sent',
      });
    }
  } else {
    // No ReferralPartner exists — create one from Lead data
    portalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newPartner = await base44.asServiceRole.entities.ReferralPartner.create({
      name: lead.name,
      email: lead.email,
      company: lead.company || '',
      phone: lead.phone || '',
      is_active: true,
      partner_status: 'Active Partner',
      unique_portal_id: portalId,
      notes: `Auto-created from Lead record ${lead.id} on ${new Date().toISOString().split('T')[0]}`,
    });
    partner = newPartner;
    wasCreated = true;
  }

  // Send portal access email only if explicitly requested
  let emailSent = false;
  if (send_email && sendgridKey) {
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
    emailSent = res.ok;
  }

  return Response.json({
    success: true,
    action: wasCreated ? 'created_partner' : 'updated_partner',
    partner_id: partner.id,
    portal_id: portalId,
    email_sent: emailSent,
    sendgrid_available: !!sendgridKey,
  });
});