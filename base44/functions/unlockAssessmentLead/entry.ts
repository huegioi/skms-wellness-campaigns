import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Called when a proposal is accepted for a client that was originally an
// MFS assessment lead. Flips is_assessment_lead → false so the client enters
// normal queues, metrics, and renewal machinery. If the client was partner-sourced,
// logs a ReferralActivity so the partner sees the conversion.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { client_id } = body;
    if (!client_id) return Response.json({ error: 'client_id is required' }, { status: 400 });

    const client = await base44.asServiceRole.entities.Client.get(client_id);
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    // Only act on assessment leads
    if (!client.is_assessment_lead) {
      return Response.json({ success: true, unlocked: false, reason: 'not_assessment_lead' });
    }

    // Flip the flag
    await base44.asServiceRole.entities.Client.update(client_id, { is_assessment_lead: false });

    // Log conversion in ReferralActivity when partner-sourced
    let activityLogged = false;
    if (client.referral_partner_id) {
      // Find the referral matching this client
      const referrals = await base44.asServiceRole.entities.Referral.filter(
        { referral_partner_id: client.referral_partner_id, referred_client_id: client_id },
        '-referral_date', 5
      );
      const referral = referrals[0];
      const companyLabel = client.company || client.name || 'Client';
      await base44.asServiceRole.entities.ReferralActivity.create({
        referral_partner_id: client.referral_partner_id,
        referral_id: referral?.id || undefined,
        message: `${companyLabel} proposal accepted — converted from assessment lead`,
        activity_date: new Date().toISOString(),
      });
      activityLogged = true;
    }

    return Response.json({
      success: true,
      unlocked: true,
      activity_logged: activityLogged,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});