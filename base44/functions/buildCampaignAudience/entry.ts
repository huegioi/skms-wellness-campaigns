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
    // Each record is tagged with _recordType so 'partner' campaigns (union of
    // Lead + ReferralPartner) can set the correct CampaignRecipient.record_type.
    let allRecords = [];
    if (campaign.audience_type === 'client') {
      allRecords = (await base44.entities.Client.list('-created_date', 500)).map(r => ({ ...r, _recordType: 'client' }));
    } else if (campaign.audience_type === 'lead') {
      allRecords = (await base44.entities.Lead.list('-created_date', 500)).map(r => ({ ...r, _recordType: 'lead' }));
    } else if (campaign.audience_type === 'referral_partner') {
      allRecords = (await base44.entities.ReferralPartner.list('-created_date', 500)).map(r => ({ ...r, _recordType: 'referral_partner' }));
    } else if (campaign.audience_type === 'partner') {
      const [leads, partners] = await Promise.all([
        base44.entities.Lead.list('-created_date', 500),
        base44.entities.ReferralPartner.list('-created_date', 500),
      ]);
      // ReferralPartner first so dedup-by-email prefers it over Lead
      allRecords = [
        ...partners.map(r => ({ ...r, _recordType: 'referral_partner' })),
        ...leads.map(r => ({ ...r, _recordType: 'lead' })),
      ];
    }

    // Exclude demo records
    allRecords = allRecords.filter(r => !r.is_demo);

    const isAllScope = campaign.audience_scope === 'all';
    const campaignTags = campaign.tag_ids || [];

    if (!isAllScope && campaignTags.length === 0) {
      return Response.json({ error: 'Campaign has no tags selected' }, { status: 400 });
    }

    // ── Match: if scope is 'all', include every record; otherwise tag-match ──
    const matched = isAllScope
      ? allRecords
      : allRecords.filter(r => r.tags && r.tags.some(t => campaignTags.includes(t)));

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
          record_type: r._recordType,
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
          record_type: r._recordType,
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
        record_type: r._recordType,
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

    // ── Duplicate outreach check: flag emails in other campaigns (drafted+, last 30 days) ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allOtherRecipients = await base44.entities.CampaignRecipient.list('-created_date', 500);
    const allCampaigns = await base44.entities.OutreachCampaign.list('-created_date', 500);
    const campaignNameMap = {};
    for (const c of allCampaigns) campaignNameMap[c.id] = c.name;

    const duplicateMap = {};
    for (const r of allOtherRecipients) {
      if (r.campaign_id === campaign_id) continue;
      if (!['drafted', 'approved', 'sent', 'replied'].includes(r.status)) continue;
      const createdDate = new Date(r.created_date);
      if (createdDate < thirtyDaysAgo) continue;
      const email = (r.email || '').toLowerCase().trim();
      if (!email) continue;
      const cName = campaignNameMap[r.campaign_id] || 'Unknown';
      const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!duplicateMap[email]) {
        duplicateMap[email] = `Also in campaign "${cName}" (${dateStr})`;
      }
    }

    for (const r of newRecipients) {
      const email = (r.email || '').toLowerCase().trim();
      if (duplicateMap[email]) {
        r.duplicate_warning = duplicateMap[email];
      }
    }

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