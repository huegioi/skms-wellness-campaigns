import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fires when a ReferralPartner record is created or updated.
 * If the partner is active and has no portal ID yet, generates one and sends an invite email.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, send_email = false } = body;

  const partner = data;

  // Provision if is_active=true OR partner_status='Active Partner', and no portal yet
  const isActive = partner?.is_active === true || partner?.partner_status === 'Active Partner';
  if (!partner || !isActive || partner.unique_portal_id) {
    return Response.json({ skipped: true, reason: 'Not active or portal already exists' });
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!partner.email || !emailRegex.test(partner.email)) {
    return Response.json({ skipped: true, reason: 'Partner email is missing or invalid' });
  }

  // Generate unique portal ID
  const uniquePortalId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

  await base44.asServiceRole.entities.ReferralPartner.update(partner.id, {
    unique_portal_id: uniquePortalId,
    is_active: true,
  });

  // Build portal URL
  const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://app.base44.com/apps/6911f6f4a9d8505805b51a3b';
  const portalUrl = `${appBaseUrl}/ReferralPortal?id=${uniquePortalId}`;

  // Send welcome/access email via SendGrid only if explicitly requested
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
  if (send_email && sendgridKey) {
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

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: partner.email, name: partner.name }] }],
        from: { email: 'william@skillfulmeans.life', name: 'SKMS Wellness' },
        subject: 'Your SKMS Wellness Partner Portal is Ready',
        content: [{ type: 'text/html', value: emailBody }],
      }),
    });
  }

  // Also update any matching broker_lead Lead records
  const matchingLeads = await base44.asServiceRole.entities.Lead.filter({
    email: partner.email,
    lead_type: 'broker_lead',
  });
  for (const lead of matchingLeads) {
    if (lead.partner_status !== 'active_partner') {
      await base44.asServiceRole.entities.Lead.update(lead.id, { partner_status: 'active_partner' });
    }
  }

  return Response.json({
    success: true,
    partner_id: partner.id,
    portal_id: uniquePortalId,
    email_sent: !!sendgridKey,
    leads_updated: matchingLeads.length,
  });
});