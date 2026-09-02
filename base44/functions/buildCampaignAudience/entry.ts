import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveClientContact } from '../../shared/clientContact.ts';

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
      allRecords = (await base44.entities.Lead.filter({ is_archived: { $ne: true } }, '-created_date', 500)).map(r => ({ ...r, _recordType: 'lead' }));
    } else if (campaign.audience_type === 'referral_partner') {
      allRecords = (await base44.entities.ReferralPartner.list('-created_date', 500)).map(r => ({ ...r, _recordType: 'referral_partner' }));
    } else if (campaign.audience_type === 'partner') {
      const [leads, partners] = await Promise.all([
        base44.entities.Lead.filter({ is_archived: { $ne: true } }, '-created_date', 500),
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

    // Full pool, keyed by id — used below to re-sync stale recipient snapshots
    // even for records that no longer match the campaign's tags.
    const poolById = new Map(allRecords.map(r => [r.id, r]));

    const isAllScope = campaign.audience_scope === 'all';

    // ── For "All Partners" scope, match the Partners page exactly ──
    // KEEP IN SYNC with frontend: src/lib/partnerAudienceFilter.js (isExcludedFromAllPartners)
    // The Partners page shows:
    //   - Leads with lead_type === 'broker_lead' (Referral Partners tab)
    //   - ReferralPartners (Referral Portals tab)
    // So for "All Partners" scope, exclude:
    //   - Leads with lead_type !== 'broker_lead' (old imports, broker, ec, company_inquiry)
    //   - Leads with status in DEAD_LEAD_STATUSES (not_interested, converted, current_client)
    //   - ReferralPartners with partner_status='Inactive' or is_active=false
    // Tag scope does NOT apply this filter.
    const DEAD_LEAD_STATUSES = ['not_interested', 'converted', 'current_client'];
    const isPartnerAllScope = isAllScope && campaign.audience_type === 'partner';
    if (isPartnerAllScope) {
      allRecords = allRecords.filter(r => {
        if (r._recordType === 'lead') return r.lead_type === 'broker_lead' && !DEAD_LEAD_STATUSES.includes(r.status);
        if (r._recordType === 'referral_partner') return r.partner_status !== 'Inactive' && r.is_active !== false;
        return true;
      });
    }

    const campaignTags = campaign.tag_ids || [];

    if (!isAllScope && campaignTags.length === 0) {
      return Response.json({ error: 'Campaign has no tags selected' }, { status: 400 });
    }

    // ── Match: if scope is 'all', include every record; otherwise tag-match ──
    let matched = isAllScope
      ? allRecords
      : allRecords.filter(r => r.tags && r.tags.some(t => campaignTags.includes(t)));

    // ── Exclude by tag: remove records with ANY exclude tag ──
    const excludeTags = campaign.exclude_tag_ids || [];
    if (excludeTags.length > 0) {
      matched = matched.filter(r => !(r.tags && r.tags.some(t => excludeTags.includes(t))));
    }

    // ── Owner filter (same position as frontend: after demo/inactive/tag, before dedupe) ──
    // Inlined from src/lib/partnerAudienceFilter.js — the Deno function cannot import
    // from src/. Keep character-for-character identical to the shared version.
    const normalizeOwner = (owner) => {
      const o = (owner || '').trim().toLowerCase();
      if (!o) return 'unassigned';
      if (o.includes('heather')) return 'heather';
      if (o.includes('william')) return 'william';
      return 'other';
    };
    const matchesOwnerFilter = (record, ownerFilterVal) => {
      if (!ownerFilterVal || ownerFilterVal === 'all') return true;
      return normalizeOwner(record.owner) === ownerFilterVal;
    };
    const ownerFilter = campaign.owner_filter || 'all';
    const ownerExcludedCount = ownerFilter !== 'all'
      ? matched.filter(r => !matchesOwnerFilter(r, ownerFilter)).length
      : 0;
    if (ownerFilter !== 'all') {
      matched = matched.filter(r => matchesOwnerFilter(r, ownerFilter));
    }

    // ── Apply user exclusions ──
    const excludedSet = new Set(excluded_record_ids);
    const included = matched.filter(r => !excludedSet.has(r.id));

    // ── Snapshot the CONTACT, not the record label ──
    // For a Client, `name` is supposed to be the primary contact, but on many
    // records it holds the ORGANIZATION instead (name === company) with the real
    // human either in related_contacts or absent. Resolve the person who actually
    // owns this email address. When there is none, snapshot an EMPTY name and
    // flag the row — an unknown contact is a data gap to surface, never a blank
    // for the drafter to fill in by guessing from the email address.
    // See base44/shared/clientContact.ts.
    const contactSnapshot = (r) => {
      if (r._recordType !== 'client') {
        return { name: r.name || '', contact_name_missing: false };
      }
      const contact = resolveClientContact(r);
      return {
        name: contact.name || '',
        contact_name_missing: contact.confidence === 'none',
      };
    };

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
        ...contactSnapshot(r),
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

    // ── Re-sync stale snapshots ──
    // Recipient rows are snapshots taken when the audience was built and were
    // never refreshed, so correcting a Client's contact never reached a campaign
    // already built from it. Refresh name/email/company on rows that have NOT
    // gone out yet. Never touch approved / sent / replied / skipped rows — those
    // snapshots are the record of what was actually sent.
    const RESYNCABLE = ['pending', 'drafting', 'drafted', 'error'];
    const pendingResync = [];
    for (const row of existing) {
      if (!RESYNCABLE.includes(row.status)) continue;
      const r = poolById.get(row.record_id);
      if (!r) continue;
      const snap = contactSnapshot({ ...r, _recordType: row.record_type });
      const next = {};
      if ((row.name || '') !== snap.name) next.name = snap.name;
      if ((row.email || '') !== (r.email || '')) next.email = r.email || '';
      if ((row.company || '') !== (r.company || '')) next.company = r.company || '';
      if (!!row.contact_name_missing !== snap.contact_name_missing) {
        next.contact_name_missing = snap.contact_name_missing;
      }
      if (Object.keys(next).length === 0) continue;
      pendingResync.push({ id: row.id, data: next });
    }
    for (let i = 0; i < pendingResync.length; i += 10) {
      await Promise.all(
        pendingResync.slice(i, i + 10).map(u =>
          base44.entities.CampaignRecipient.update(u.id, u.data)
            .catch(e => console.error('[buildCampaignAudience] resync failed', u.id, e.message))
        )
      );
    }

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

    const missingContactName =
      newRecipients.filter(r => r.contact_name_missing).length +
      existing.filter(r =>
        RESYNCABLE.includes(r.status) &&
        (pendingResync.find(u => u.id === r.id)?.data.contact_name_missing ?? r.contact_name_missing)
      ).length;

    return Response.json({
      created: newRecipients.length,
      skipped: newSkipped.length,
      total_recipients: existing.length + allNew.length,
      owner_excluded: ownerExcludedCount,
      resynced: pendingResync.length,
      missing_contact_name: missingContactName,
    });
  } catch (error) {
    console.error('[buildCampaignAudience] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});