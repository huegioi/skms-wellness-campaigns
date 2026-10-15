import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { senderForRecipient, gmailAccessToken, findSentCampaignEmail, finalFields } from '../../shared/writingStyle.ts';

/**
 * repairCampaignSendLinks — one-off repair (2026-10-15), admin only, read-only against Gmail.
 *
 * Until today syncCampaignSendStatus recorded the NEWEST email sent to a person after the
 * campaign draft was approved. When William/Heather later emailed that person about
 * something else, that later email became "the campaign email": wrong sent_at, and a wrong
 * thread_id / Message-ID — which would have put follow-up bumps in the wrong conversation.
 *
 * For each sent/replied campaign row this re-finds the campaign email the careful way
 * (earliest sent message after approval whose subject/text matches the draft) and, when the
 * stored link points elsewhere, corrects sent_at, thread_id, rfc_message_id and the linked
 * EmailLog. Unsent follow-up rows that inherited the wrong thread are corrected too.
 *
 * Body: { dryRun = true, offset = 0, limit = 15 } → { checked, fixes, unconfirmed, next_offset }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch { /* defaults */ }
    const dryRun = body?.dryRun !== false;
    const offset = Math.max(0, Number(body?.offset) || 0);
    const limit = Math.min(Math.max(1, Number(body?.limit) || 15), 40);
    const db = base44.asServiceRole.entities;

    const [sent, replied, campaigns] = await Promise.all([
      db.CampaignRecipient.filter({ status: 'sent' }, 'created_date', 1000),
      db.CampaignRecipient.filter({ status: 'replied' }, 'created_date', 1000),
      db.OutreachCampaign.list('-created_date', 500),
    ]);
    const campaignById = Object.fromEntries(campaigns.map(c => [c.id, c]));
    const all = [...sent, ...replied]
      .filter(r => r.email && r.approved_at)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const slice = all.slice(offset, offset + limit);

    const tokens: Record<string, string | null> = {};
    const fixes: any[] = [];
    const unconfirmed: any[] = [];

    for (const r of slice) {
      const sender = senderForRecipient(r, campaignById[r.campaign_id]);
      if (!(sender in tokens)) tokens[sender] = await gmailAccessToken(base44, sender);
      const token = tokens[sender];
      if (!token) { unconfirmed.push({ id: r.id, name: r.name || r.email, reason: `no access to ${sender}'s Gmail` }); continue; }

      let found = null;
      try { found = await findSentCampaignEmail(token, r, { approvalWindowOnly: true }); } catch { /* treated as not found */ }
      if (!found) { unconfirmed.push({ id: r.id, name: r.name || r.email, campaign: campaignById[r.campaign_id]?.name, reason: 'campaign email not found in Sent — left as is' }); continue; }

      const sentDiff = Math.abs(new Date(found.sentAt || 0).getTime() - new Date(r.sent_at || 0).getTime());
      const wrongThread = !!found.threadId && found.threadId !== r.thread_id;
      const wrongDate = !r.sent_at || sentDiff > 10 * 60 * 1000;
      const patch: any = {};
      if (wrongThread || wrongDate) {
        patch.sent_at = found.sentAt;
        patch.thread_id = found.threadId;
        if (found.rfcMessageId) patch.rfc_message_id = found.rfcMessageId;
      }
      // The verified sent text also feeds writing-style learning
      if (r.final_source !== 'gmail_sent' && !r.style_status) Object.assign(patch, finalFields(r, found, 'gmail_sent'));
      if (!Object.keys(patch).length) continue;

      const followups = (wrongThread)
        ? (await db.CampaignRecipient.filter({ parent_recipient_id: r.id }, 'followup_round', 10))
        : [];
      const fix = {
        id: r.id,
        name: r.name || r.email,
        campaign: campaignById[r.campaign_id]?.name,
        link_fixed: wrongThread || wrongDate,
        was_sent_at: r.sent_at,
        now_sent_at: found.sentAt,
        campaign_subject: found.subject,
        followups_retargeted: followups.filter(f => ['pending', 'drafting', 'drafted', 'error'].includes(f.status)).length,
        followups_already_in_gmail: followups.filter(f => ['approved', 'sent', 'replied'].includes(f.status)).map(f => ({ id: f.id, status: f.status })),
      };
      fixes.push(fix);

      if (!dryRun) {
        await db.CampaignRecipient.update(r.id, patch);
        if ((wrongThread || wrongDate) && r.email_log_id) {
          try { await db.EmailLog.update(r.email_log_id, { gmail_message_id: found.messageId, date: found.sentAt, is_draft: false }); } catch { /* log row may be gone */ }
        }
        for (const f of followups) {
          if (['pending', 'drafting', 'drafted', 'error'].includes(f.status)) {
            await db.CampaignRecipient.update(f.id, { thread_id: found.threadId, rfc_message_id: found.rfcMessageId || f.rfc_message_id });
          }
        }
      }
    }

    const next = offset + slice.length;
    return Response.json({
      dry_run: dryRun,
      total: all.length,
      checked: slice.length,
      next_offset: next < all.length ? next : null,
      fixes: fixes.filter(f => f.link_fixed),
      text_captured: fixes.length - fixes.filter(f => f.link_fixed).length,
      unconfirmed,
    });
  } catch (error) {
    console.error('[repairCampaignSendLinks]', (error as any)?.message, (error as any)?.stack);
    return Response.json({ error: (error as any)?.message }, { status: 500 });
  }
});
