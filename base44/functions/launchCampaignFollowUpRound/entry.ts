import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ═══════════════════════════════════════════════════════════════════════════
// launchCampaignFollowUpRound — create follow-up "bump" recipient rows for a
// campaign, targeting people whose previous campaign email was SENT but never
// answered. NEVER sends email. The new rows are status 'pending' and flow
// through the same draft → review → approve(=Gmail draft) pipeline as round 1.
//
// Eligibility per email (grouped across ALL of the campaign's recipient rows):
//   1. Latest round's status is 'sent' (a sent touch exists).
//   2. NO row for that email is 'replied' (a reply to any round permanently
//      excludes them).
//   3. Latest sent_at is >= wait_days ago.
//   4. max followup_round < 3 (cap: 3 follow-ups, 4 total touches).
// Plus an in-flight guard: any row still pending/drafting/drafted/approved
// means a round is mid-flight → not eligible.
//
// preview: true → returns { eligible_count, sample: first 5 names }, no writes.
// preview: false → creates a CampaignFollowUpLaunch + one CampaignRecipient per
//   eligible email (followup_round = max+1, parent = round-0 row, thread_id +
//   rfc_message_id carried from the latest sent row), returns counts.
//
// Auth follows the existing campaign functions' pattern (base44.auth.me()).
// ═══════════════════════════════════════════════════════════════════════════

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

    const {
      campaign_id,
      guidance = '',
      selected_ctas = [],
      wait_days = 3,
      preview = false,
    } = body;

    if (!campaign_id) {
      return Response.json({ error: 'Missing campaign_id' }, { status: 400 });
    }

    const campaign = await base44.entities.OutreachCampaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Load all of the campaign's recipient rows ──
    const allRecipients = await base44.entities.CampaignRecipient.filter(
      { campaign_id },
      '-created_date',
      500
    );

    // ── Group by lowercased email ──
    const byEmail = {};
    for (const r of allRecipients) {
      const email = (r.email || '').toLowerCase().trim();
      if (!email) continue;
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(r);
    }

    const waitMs = (Number(wait_days) || 3) * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const eligible = [];

    for (const [email, rows] of Object.entries(byEmail)) {
      // Condition 2: a reply to ANY round permanently excludes this email.
      if (rows.some(r => r.status === 'replied')) continue;

      // In-flight guard: a round still mid-flight (not yet sent/approved) means
      // this person is not ready for another bump.
      const inFlight = rows.some(r =>
        ['pending', 'drafting', 'drafted', 'approved'].includes(r.status)
      );
      if (inFlight) continue;

      // Condition 1: latest round's status must be 'sent'. Determine the
      // latest round only among sent rows (skip skipped/error/pending/drafted/
      // approved — those emails are NOT eligible; never-sent recipients need a
      // regenerated round 1, not a bump, and are out of scope here).
      const sentRows = rows
        .filter(r => r.status === 'sent')
        .sort((a, b) =>
          ((b.followup_round || 0) - (a.followup_round || 0)) ||
          (new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime())
        );
      if (sentRows.length === 0) continue;

      const latestSent = sentRows[0];

      // Condition 3: latest sent_at must be >= wait_days ago.
      const sentTs = new Date(latestSent.sent_at).getTime();
      if (isNaN(sentTs) || (now - sentTs) < waitMs) continue;

      // Condition 4: max followup_round < 3 (server-side cap).
      const maxRound = Math.max(...rows.map(r => r.followup_round || 0));
      if (maxRound >= 3) continue;

      // Round-0 parent row (the original outreach this bump descends from).
      const round0 = rows.find(r => (r.followup_round || 0) === 0);

      eligible.push({
        email,
        round0Id: round0?.id || latestSent.id,
        latestSent,
        newRound: maxRound + 1,
      });
    }

    // ── Preview: report eligibility, change nothing ──
    if (preview) {
      const sample = eligible.slice(0, 5).map(e => e.latestSent.name || e.email);
      return Response.json({
        eligible_count: eligible.length,
        sample,
        wait_days: Number(wait_days) || 3,
      });
    }

    // ── Launch: create the launch record + follow-up recipient rows ──
    const launch = await base44.entities.CampaignFollowUpLaunch.create({
      campaign_id,
      launched_at: new Date().toISOString(),
      guidance: guidance || '',
      selected_ctas: Array.isArray(selected_ctas) ? selected_ctas : [],
      wait_days: Number(wait_days) || 3,
      recipient_count: eligible.length,
    });

    const newRows = eligible.map(e => ({
      campaign_id,
      record_type: e.latestSent.record_type,
      record_id: e.latestSent.record_id,
      name: e.latestSent.name || '',
      email: e.latestSent.email,
      company: e.latestSent.company || '',
      owner: e.latestSent.owner || '',
      status: 'pending',
      cc_emails: e.latestSent.cc_emails || [],
      followup_round: e.newRound,
      parent_recipient_id: e.round0Id,
      launch_id: launch.id,
      thread_id: e.latestSent.thread_id || undefined,
      rfc_message_id: e.latestSent.rfc_message_id || undefined,
    }));

    let created = 0;
    if (newRows.length > 0) {
      await base44.entities.CampaignRecipient.bulkCreate(newRows);
      created = newRows.length;
    }

    return Response.json({
      launched: true,
      launch_id: launch.id,
      eligible_count: eligible.length,
      created,
    });
  } catch (error) {
    console.error('[launchCampaignFollowUpRound] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});