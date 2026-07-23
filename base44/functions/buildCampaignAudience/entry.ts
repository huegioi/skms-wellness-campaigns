import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const body = await req.json();
    const { campaign_id, excluded_record_ids = [] } = body;

    if (!campaign_id) {
      return Response.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    const campaign = await base44.entities.OutreachCampaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Fetch all records of the audience type ──
    let allRecords = [];
    if (campaign.audience_type === 'client') {
      allRecords = await base44.entities.Client.list('-created_date', 500);
    } else if (campaign.audience_type === 'lead') {
      allRecords = await base44.entities.Lead.list('-created_date', 500);
    } else if (campaign.audience_type === 'referral_partner') {
      allRecords = await base44.entities.ReferralPartner.list('-created_date', 500);
    }

    // Exclude demo records
    allRecords = allRecords.filter(r => !r.is_demo);

    const campaignTags = campaign.tag_ids || [];
    if (campaignTags.length === 0) {
      return Response.json({ error: 'Campaign has no tags selected' }, { status: 400 });
    }

    // ── Match: record has ANY of the campaign tags ──
    const matched = allRecords.filter(r =>
      r.tags && r.tags.some(t => campaignTags.includes(t))
    );

    // ── Apply user exclusions ──
    const excludedSet = new Set(excluded_record_ids);
    const included = matched.filter(r => !excludedSet.has(r.id));

    // ── Dedupe by email, skip no-email ──
    const seenEmails = new Map();
    const toCreate = [];
    const skipped = [];

    for (const r of included) {
      const email = (r.email || '').toLowerCase().trim();
      if (!email) {
        skipped.push({
          campaign_id,
          record_type: campaign.audience_type,
          record_id: r.id,
          name: r.name || '',
          status: 'skipped',
          error_message: 'no email address',
        });
        continue;
      }
      if (seenEmails.has(email)) {
        skipped.push({
          campaign_id,
          record_type: campaign.audience_type,
          record_id: r.id,
          name: r.name || '',
          email: r.email,
          company: r.company || '',
          owner: r.owner || '',
          status: 'skipped',
          error_message: 'duplicate email in campaign',
          cc_emails: campaign.cc_emails || [],
        });
        continue;
      }
      seenEmails.set(email, r.id);
      toCreate.push({
        campaign_id,
        record_type: campaign.audience_type,
        record_id: r.id,
        name: r.name || '',
        email: r.email,
        company: r.company || '',
        owner: r.owner || '',
        status: 'pending',
        cc_emails: campaign.cc_emails || [],
      });
    }

    // ── Fetch existing recipients (for refresh — don't duplicate) ──
    const existing = await base44.entities.CampaignRecipient.filter(
      { campaign_id }, '-created_date', 500
    );
    const existingRecordIds = new Set(existing.map(e => e.record_id));

    // Only create recipients for NEW matches
    const newRecipients = toCreate.filter(r => !existingRecordIds.has(r.record_id));
    const newSkipped = skipped.filter(r => !existingRecordIds.has(r.record_id));

    const allNew = [...newRecipients, ...newSkipped];
    if (allNew.length > 0) {
      await base44.entities.CampaignRecipient.bulkCreate(allNew);
    }

    return Response.json({
      created: newRecipients.length,
      skipped: newSkipped.length,
      total_recipients: existing.length + allNew.length,
    });
  } catch (error) {
    console.error('[buildCampaignAudience] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});