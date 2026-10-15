import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { voiceFor } from '../../shared/senderVoice.ts';
import {
  SENDER_NAME, senderForRecipient, gmailAccessToken, findSentCampaignEmail,
  finalFields, mayaVersion, UNCHANGED_THRESHOLD,
} from '../../shared/writingStyle.ts';

/**
 * learnWritingStyle — learns how William / Heather actually write by comparing Maya's
 * campaign drafts with what went out (2026-10-15). Read-only against Gmail; never sends.
 *
 * Phase 1 (capture): for sent/replied campaign emails we have not read yet, pull the sent
 *   text from the sender's Gmail (signature + quoted thread stripped) → final_* + edit_ratio.
 *   Emails that went out essentially untouched are marked "unchanged" (a vote for Maya's draft).
 * Phase 2 (learn): per sender, give the model the current profile + the newest edited pairs;
 *   it returns the updated rule list (max 15), up to 3 before→after examples and a summary.
 *   Saved to WritingStyleProfile, which generateCampaignDraft uses for every new draft.
 *
 * Body (all optional): { sender: 'william'|'heather', captureLimit: 40, learnLimit: 20 }
 * Runs nightly ("Learn Writing Style - Nightly") and from the "Learn from my edits" button.
 */

const CAPTURE_DEFAULT = 40;
const LEARN_DEFAULT = 20;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch { /* scheduled run: no body */ }
    // Scheduled runs have no user; a manual call must come from a signed-in team member.
    const user = await base44.auth.me().catch(() => null);
    const isScheduled = !user;
    if (!isScheduled && !['admin', 'user'].includes(user.role)) {
      return Response.json({ error: 'Not allowed' }, { status: 403 });
    }
    const db = base44.asServiceRole.entities;
    const onlySender = body?.sender === 'heather' || body?.sender === 'william' ? body.sender : null;
    const captureLimit = Math.min(Number(body?.captureLimit) || CAPTURE_DEFAULT, 80);
    const learnLimit = Math.min(Number(body?.learnLimit) || LEARN_DEFAULT, 30);

    const [sentRows, repliedRows, campaigns] = await Promise.all([
      db.CampaignRecipient.filter({ status: 'sent' }, '-sent_at', 1000),
      db.CampaignRecipient.filter({ status: 'replied' }, '-sent_at', 1000),
      db.OutreachCampaign.list('-created_date', 500),
    ]);
    const campaignById = Object.fromEntries(campaigns.map(c => [c.id, c]));
    const rows = [...sentRows, ...repliedRows]
      .filter(r => r.email && (r.maya_body || r.draft_body))
      .map(r => ({ ...r, _sender: senderForRecipient(r, campaignById[r.campaign_id]) }))
      .filter(r => !onlySender || r._sender === onlySender)
      .sort((a, b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime());

    // ── Phase 1: read what was actually sent ────────────────────────────────
    const tokens: Record<string, string | null> = {};
    const notes: string[] = [];
    let captured = 0, notFound = 0;
    const toCapture = rows.filter(r => r.final_source !== 'gmail_sent' && !r.style_status);
    for (const r of toCapture.slice(0, captureLimit)) {
      if (!(r._sender in tokens)) {
        tokens[r._sender] = await gmailAccessToken(base44, r._sender);
        if (!tokens[r._sender]) notes.push(`Couldn't read ${SENDER_NAME[r._sender]}'s Gmail — her/his sent emails are skipped for now.`);
      }
      const token = tokens[r._sender];
      if (!token) continue;
      try {
        const sent = await findSentCampaignEmail(token, r);
        let patch;
        if (sent?.body) {
          patch = finalFields(r, sent, 'gmail_sent');
          captured++;
        } else if (r.final_body || r.draft_body) {
          // Not in Sent any more (deleted / different mailbox): fall back to the approved text,
          // which still holds any edits made in the app.
          patch = { ...finalFields(r, { subject: r.final_subject || r.draft_subject, body: r.final_body || r.draft_body }, 'approved') };
          patch.style_status = patch.edit_ratio < UNCHANGED_THRESHOLD ? 'unchanged' : 'pending';
          notFound++;
        } else {
          patch = { style_status: 'skipped' };
          notFound++;
        }
        await db.CampaignRecipient.update(r.id, patch);
        Object.assign(r, patch);
      } catch (e) {
        console.warn('[learnWritingStyle] capture failed', r.id, (e as any)?.message);
      }
    }
    const stillToRead = Math.max(0, toCapture.length - captureLimit);

    // ── Phase 2: learn per sender ───────────────────────────────────────────
    const results: any[] = [];
    for (const sender of onlySender ? [onlySender] : ['william', 'heather']) {
      const mine = rows.filter(r => r._sender === sender);
      const unchangedNew = mine.filter(r => r.style_status === 'unchanged' && !r.style_learned_at);
      const pending = mine.filter(r => r.style_status === 'pending' && r.final_body);
      const batch = pending.slice(0, learnLimit);

      let profile = (await db.WritingStyleProfile.filter({ sender }, '-updated_date', 1))?.[0];
      if (!profile) profile = await db.WritingStyleProfile.create({ sender, is_active: true, learned_rules: [], examples: [], edits_analyzed: 0, unchanged_count: 0 });

      const now = new Date().toISOString();
      if (unchangedNew.length) {
        for (const r of unchangedNew) await db.CampaignRecipient.update(r.id, { style_learned_at: now });
        profile = await db.WritingStyleProfile.update(profile.id, { unchanged_count: (profile.unchanged_count || 0) + unchangedNew.length }) || profile;
      }
      if (!batch.length) {
        results.push({ sender, learned_from: 0, unchanged: unchangedNew.length, remaining: 0 });
        continue;
      }

      const name = SENDER_NAME[sender];
      const pairs = batch.map((r, i) => {
        const before = mayaVersion(r);
        return `### Edit ${i + 1} (${Math.round((r.edit_ratio || 0) * 100)}% of words changed${r.followup_round ? `, follow-up #${r.followup_round}` : ''})
MAYA'S SUBJECT: ${before.subject}
SENT SUBJECT: ${r.final_subject || before.subject}
MAYA'S DRAFT:
${before.body.slice(0, 1800)}
WHAT ${name.toUpperCase()} SENT:
${String(r.final_body).slice(0, 1800)}`;
      }).join('\n\n');

      const currentRules = (profile.learned_rules || []).map((r, i) => `${i + 1}. ${r}`).join('\n') || '(none yet)';
      const currentExamples = (profile.examples || []).map(e => `BEFORE: ${e.before}\nAFTER: ${e.after}${e.why ? `\nWHY: ${e.why}` : ''}`).join('\n\n') || '(none yet)';

      const prompt = `You maintain a short style guide that tells an AI assistant (Maya) how ${name} writes outreach emails. You learn it by comparing what Maya drafted with what ${name} actually sent after editing.

THE BASE VOICE GUIDE MAYA ALREADY FOLLOWS (do not restate it; only add refinements the edits prove, or corrections where ${name}'s edits contradict it):
${voiceFor(sender)}

${name.toUpperCase()}'S OWN RULES (fixed by ${name}; never repeat or contradict them):
${profile.own_rules || '(none)'}

CURRENT LEARNED RULES:
${currentRules}

CURRENT EXAMPLES:
${currentExamples}

NEW EDITS — Maya's draft vs. what ${name} sent:
${pairs}

YOUR TASK
1. Work out what ${name} consistently changes: length, openings and greetings, sign-off, sentences or phrases removed or added, formality, warmth, how the ask and links are framed, subject lines, paragraphing, punctuation habits.
2. Return the COMPLETE updated rule list (at most 15 rules). Keep current rules unless the new edits contradict them; merge duplicates; drop rules the edits show are wrong.
   - Add a rule only when the pattern shows up in at least two edits, or when one edit shows an unmistakable standing preference (e.g. a different sign-off).
   - Each rule is one imperative sentence, concrete, with a short quoted phrase as illustration when useful (e.g. 'Cut "I hope this finds you well" style openers').
   - Never write rules about specific people, companies, events, products or facts — style only.
3. Ignore differences that are content rather than style: facts ${name} added about the recipient, corrected names, swapped links, dates.
4. Choose up to 3 short before→after excerpts (each under 60 words) that best show the style — new ones from these edits, or keep current ones if they are still the best. Replace recipient names with [Name], companies with [Company], events with [Event].
5. summary: one or two plain sentences, written to ${name}, on what changed in the guide this round (or that the edits confirmed it).`;

      const schema = {
        type: 'object',
        properties: {
          rules: { type: 'array', items: { type: 'string' } },
          examples: { type: 'array', items: { type: 'object', properties: { before: { type: 'string' }, after: { type: 'string' }, why: { type: 'string' } }, required: ['before', 'after'] } },
          summary: { type: 'string' },
        },
        required: ['rules', 'summary'],
      };

      let out = null;
      for (let attempt = 0; attempt < 2 && !out; attempt++) {
        try {
          const res = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6', response_json_schema: schema });
          const parsed = typeof res === 'string' ? JSON.parse(res.replace(/```json\n?|```\n?/g, '').trim()) : res;
          if (Array.isArray(parsed?.rules)) out = parsed;
        } catch (e) {
          console.error('[learnWritingStyle] model call failed:', (e as any)?.message);
        }
      }
      if (!out) {
        results.push({ sender, error: 'The model did not return a usable style guide; nothing was changed.', remaining: pending.length });
        continue;
      }

      await db.WritingStyleProfile.update(profile.id, {
        learned_rules: out.rules.map(r => String(r).trim()).filter(Boolean).slice(0, 15),
        examples: (Array.isArray(out.examples) ? out.examples : []).filter(e => e?.before && e?.after).slice(0, 3),
        edits_analyzed: (profile.edits_analyzed || 0) + batch.length,
        last_learned_at: now,
        last_summary: String(out.summary || '').slice(0, 1000),
      });
      for (const r of batch) await db.CampaignRecipient.update(r.id, { style_status: 'learned', style_learned_at: now });

      results.push({ sender, learned_from: batch.length, unchanged: unchangedNew.length, remaining: pending.length - batch.length, summary: out.summary });
    }

    return Response.json({
      success: true,
      scheduled: isScheduled,
      captured_from_gmail: captured,
      not_found_in_gmail: notFound,
      still_to_read: stillToRead,
      results,
      notes: notes.length ? notes : undefined,
    });
  } catch (error) {
    console.error('[learnWritingStyle] Error:', (error as any)?.message, (error as any)?.stack);
    return Response.json({ error: (error as any)?.message }, { status: 500 });
  }
});
