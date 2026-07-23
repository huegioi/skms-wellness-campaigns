import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { recipient_id } = body;
    if (!recipient_id) {
      return Response.json({ error: 'Missing recipient_id' }, { status: 400 });
    }

    // ── Load recipient and campaign ──
    const recipient = await base44.entities.CampaignRecipient.get(recipient_id);
    if (!recipient) {
      return Response.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const campaign = await base44.entities.OutreachCampaign.get(recipient.campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Resolve sender ──
    let sender;
    if (campaign.sender_mode === 'heather') {
      sender = 'heather';
    } else if (campaign.sender_mode === 'william') {
      sender = 'william';
    } else {
      // record_owner: 'heather' in owner field → Heather, else William
      const owner = (recipient.owner || '').toLowerCase();
      sender = owner.includes('heather') ? 'heather' : 'william';
    }
    const senderName = sender === 'heather' ? 'Heather' : 'William';

    // ── Linkage fields by record_type ──
    const linkage = {};
    if (recipient.record_type === 'client') linkage.client_id = recipient.record_id;
    else if (recipient.record_type === 'lead') linkage.lead_id = recipient.record_id;
    else if (recipient.record_type === 'referral_partner') linkage.referral_partner_id = recipient.record_id;

    // ── Invoke gmailCreateDraft (creates Gmail draft + EmailLog row) ──
    const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
    const draftRes = await base44.functions.invoke('gmailCreateDraft', {
      internal_key: _ik,
      sender,
      to: recipient.email,
      cc: recipient.cc_emails || [],
      subject: recipient.draft_subject || '',
      body: recipient.draft_body || '',
      ...linkage,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
    });

    if (draftRes.status !== 200 || draftRes.data?.error) {
      const errMsg = draftRes.data?.error || `gmailCreateDraft returned status ${draftRes.status}`;
      // Surface the error on the recipient row
      await base44.entities.CampaignRecipient.update(recipient_id, { error_message: errMsg });
      return Response.json({ error: errMsg }, { status: draftRes.status || 500 });
    }

    const { gmail_draft_id, email_log_id } = draftRes.data;

    // ── Create ClientInteraction ──
    const interaction = await base44.entities.ClientInteraction.create({
      interaction_type: 'email',
      channel: 'email',
      date: new Date().toISOString(),
      subject: `[Campaign: ${campaign.name}] ${recipient.draft_subject || ''}`,
      owner: senderName,
      email_log_id,
      ...linkage,
    });

    // ── Update recipient ──
    await base44.entities.CampaignRecipient.update(recipient_id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      gmail_draft_id,
      email_log_id,
      interaction_id: interaction.id,
      error_message: null,
    });

    // ── Set campaign status to 'active' (at least one approved) ──
    if (campaign.status !== 'active' && campaign.status !== 'completed') {
      await base44.entities.OutreachCampaign.update(campaign.id, { status: 'active' });
    }

    return Response.json({
      success: true,
      recipient_id,
      gmail_draft_id,
      email_log_id,
      interaction_id: interaction.id,
    });
  } catch (error) {
    console.error('[approveCampaignDraft] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});