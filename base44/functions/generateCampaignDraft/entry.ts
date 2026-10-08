import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { senderForOwner } from '../../shared/owners.ts';
import { buildRecipientBrief } from '../../shared/draftContext.ts';
import { voiceFor } from '../../shared/senderVoice.ts';

/**
 * Writes ONE campaign email draft for ONE recipient. Never sends anything.
 *
 * Rebuilt 2026-10-07 because drafts were generic (the template was copied nearly word
 * for word into every email) and ignored most of what we know about each person:
 *   - context comes from shared/draftContext.ts (notes, meeting notes, real email bodies
 *     both ways, logged touches, stage / next step, event, brokerage, earlier campaign
 *     emails) — and works for referral partners, which used to get no context at all
 *   - the writer is the SENDER (William / Heather) in their own voice (shared/senderVoice.ts),
 *     not Maya's internal analyst persona with its tables-and-bullets formatting rules
 *   - the template is treated as the BRIEF (purpose, offer, CTA), not text to copy
 *   - follow-ups see the whole thread and switch to a real reply if they already wrote back
 *   - "regenerate with feedback" shows the model the current draft + all earlier feedback
 *   - the brief the model saw is saved on the row (draft_context) for "What Maya used"
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    const { campaign_id, recipient_id, feedback } = body;
    if (!campaign_id || !recipient_id) {
      return Response.json({ error: 'Missing campaign_id or recipient_id' }, { status: 400 });
    }

    // ── 1. Campaign + recipient ──
    const campaign = await base44.entities.OutreachCampaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    const recipient = await base44.entities.CampaignRecipient.get(recipient_id);
    if (!recipient || recipient.campaign_id !== campaign_id) {
      return Response.json({ error: 'Recipient not found or does not belong to campaign' }, { status: 404 });
    }
    const previousDraft = recipient.draft_body ? { subject: recipient.draft_subject, body: recipient.draft_body } : null;
    await base44.entities.CampaignRecipient.update(recipient_id, { status: 'drafting' });

    // ── 2. What we know about them ──
    const brief = await buildRecipientBrief(base44, recipient, { campaignId: campaign_id });

    // Knowledge base: pick entries relevant to THIS campaign (it used to get whichever 3
    // entries were edited last, because no question was passed).
    let knowledgeText = '';
    try {
      const bundleRes = await base44.functions.invoke('mayaContext', {
        action: 'bundle',
        record_type: recipient.record_type,
        record_id: recipient.record_id,
        categories: ['sales_process', 'products', 'positioning'],
        question: [campaign.name, campaign.description, campaign.personalization_notes, campaign.subject_template].filter(Boolean).join(' — '),
        internal_key: Deno.env.get('MAYA_INTERNAL_KEY'),
      });
      knowledgeText = bundleRes?.data?.knowledgeText || '';
    } catch (e) {
      console.warn('[generateCampaignDraft] knowledge lookup failed:', (e as any)?.message);
    }

    // ── 3. Who sends it ──
    const sender = campaign.sender_mode === 'heather' ? 'heather'
      : campaign.sender_mode === 'william' ? 'william'
      : senderForOwner(recipient.owner);
    const senderFirst = sender === 'heather' ? 'Heather' : 'William';

    // Name: always from the live record (the row's snapshot can be stale)
    const hasName = !!brief.firstName;
    const NAME_RULES = `NAME RULES (absolute):
${hasName
  ? `- Greet them as "${brief.firstName}". Use no other name for them.`
  : `- We do NOT know this person's name. Open with "Hi there," or "Hello,".`}
- Never build a name from an email address ("adileone@" is not "Adi") and never greet the company as if it were a person.
- Other people named in the brief are not the recipient.`;

    // ── 4. Follow-up thread (rounds ≥ 1) ──
    const isFollowup = (recipient.followup_round || 0) >= 1;
    let threadBlock = '';
    let replyBlock = '';
    let followSubject = '';
    let launch = null;
    if (isFollowup) {
      if (recipient.launch_id) {
        try { launch = await base44.entities.CampaignFollowUpLaunch.get(recipient.launch_id); } catch { /* optional */ }
      }
      const emailKey = (recipient.email || '').toLowerCase().trim();
      const siblings = (await base44.entities.CampaignRecipient.filter({ campaign_id }, 'followup_round', 500))
        .filter(s => (s.email || '').toLowerCase().trim() === emailKey && s.id !== recipient.id && s.status === 'sent')
        .sort((a, b) => (a.followup_round || 0) - (b.followup_round || 0));
      const first = siblings[0];
      followSubject = 'Re: ' + String(first?.draft_subject || campaign.subject_template || '').replace(/^(re:\s*)+/i, '');
      threadBlock = siblings.length
        ? siblings.map(s => `--- ${s.followup_round ? `Follow-up ${s.followup_round}` : 'Original email'} (sent ${s.sent_at ? new Date(s.sent_at).toDateString() : 'recently'}):\n${s.draft_body || ''}`).join('\n\n')
        : '(no earlier email found)';
      const firstSent = first?.sent_at ? new Date(first.sent_at).getTime() : 0;
      const theirs = brief.lastTheyWrote;
      if (theirs && firstSent && new Date(theirs.date).getTime() > firstSent) {
        replyBlock = `THEY HAVE ALREADY WRITTEN BACK (${new Date(theirs.date).toDateString()}): "${String(theirs.body_preview || theirs.snippet || '').slice(0, 500)}"
→ Do NOT write a "bump". Write a short, natural reply to what they said.`;
      }
    }

    // ── 5. Calls to action ──
    const ctas = isFollowup
      ? (Array.isArray(launch?.selected_ctas) ? launch.selected_ctas : [])
      : (Array.isArray(campaign.selected_ctas) ? campaign.selected_ctas : []);
    const ctaBlock = ctas.length
      ? `LINKS YOU MAY USE (pick the ONE that fits this person best; put the bare URL in a natural sentence):
${ctas.map(c => `- ${c.label || ''}: ${c.url || ''}${c.guidance ? ` (when to use: ${c.guidance})` : ''}`).join('\n')}`
      : '';

    const feedbackBlock = feedback
      ? `REVISION REQUEST from ${senderFirst === 'Heather' ? 'Heather/William' : 'William/Heather'} — this overrides everything else:
"${feedback}"${recipient.feedback_note && recipient.feedback_note !== feedback ? `\nEarlier feedback on this draft (still applies unless contradicted): "${recipient.feedback_note}"` : ''}${previousDraft ? `\nTHE CURRENT DRAFT YOU ARE REVISING:\nSubject: ${previousDraft.subject}\n${previousDraft.body}` : ''}`
      : '';

    const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `${voiceFor(sender)}

Today is ${today}. You are writing one email to one person. It must read as if ${senderFirst} wrote it to them personally — never like a mail merge.

${isFollowup ? `THIS IS FOLLOW-UP #${recipient.followup_round} IN AN EMAIL THREAD.
THE THREAD SO FAR:
${threadBlock}

${replyBlock}
GUIDANCE FOR THIS ROUND: ${launch?.guidance || '(none)'}

RULES FOR THE FOLLOW-UP:
- 2 to 4 sentences. Do not repeat what earlier emails said.
- Bring ONE new thing: a detail from the brief about them, a useful resource, or a simple question. Never open with "just bumping this" / "following up".
- Subject must be exactly: ${followSubject}` : `THE CAMPAIGN BRIEF (what this email is for):
Campaign: ${campaign.name || ''}${campaign.description ? ` — ${campaign.description}` : ''}
Template subject: ${campaign.subject_template || ''}
Template body:
${campaign.body_template || ''}
Personalization notes from ${senderFirst === 'Heather' ? 'Heather' : 'William'}: ${campaign.personalization_notes || '(none)'}

HOW TO USE THE TEMPLATE:
- It is a BRIEF, not text to paste. Keep its purpose, its facts/offer and its ask.
- Rewrite generic sentences in the sender's voice so they connect to THIS person. Do not copy more than one sentence of it word for word.
- Fill any [PERSONALIZE: …] or {{merge}} slot with real content from the brief, never with a placeholder.
- Length: about the template's length or shorter — the voice rules above win.
- Subject: short and specific to them (you may adapt the template subject).`}

PERSONALIZATION (the most important part):
- Open with the single most relevant REAL thing from the brief below: something they said or wrote, what came out of a meeting, the event where we met, their next step, a referral they sent, their company's situation.
- Use only facts that appear in the brief. If the brief is thin, keep it simple and honest (e.g. where we met, their company) — never pretend to a history that isn't there.
- If they were already emailed by another campaign recently (see brief), do not write as if this is first contact.
- If something in the brief makes this email a bad idea (they said no, they asked not to be contacted, they are mid-conversation on another topic), still write a sensible draft but say so in "concerns".

${NAME_RULES}

${ctaBlock}

${feedbackBlock}

WHAT WE KNOW ABOUT THEM:
${brief.text}

${knowledgeText ? `SKILLFULMEANS BACKGROUND (use only if it helps this person; never paste it in):\n${knowledgeText.slice(0, 3000)}` : ''}

FORMAT: plain text email paragraphs. No bullet points, no numbered lists, no markdown, no bold. Exactly one ask.`;

    // ── 6. Call the model (structured output) ──
    const schema = {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        hooks_used: { type: 'array', items: { type: 'string' }, description: 'The specific facts from the brief this email relies on, in a few words each' },
        concerns: { type: 'string', description: 'Anything the sender should check before sending; empty if none' },
      },
      required: ['subject', 'body'],
    };

    let out = null;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      try {
        const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt, model: 'claude_sonnet_4_6', response_json_schema: schema,
        });
        let parsed = res;
        if (typeof res === 'string') {
          parsed = JSON.parse(res.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        }
        if (parsed?.subject && parsed?.body) out = parsed;
        else lastError = 'Model returned an empty subject or body';
      } catch (e) {
        lastError = 'Draft generation failed: ' + (e as any)?.message;
        console.error('[generateCampaignDraft]', lastError);
      }
    }

    if (!out) {
      await base44.entities.CampaignRecipient.update(recipient_id, { status: 'error', error_message: lastError || 'Empty response' });
      return Response.json({ error: lastError || 'Failed to generate draft', recipient_id }, { status: 500 });
    }

    const subject = isFollowup && followSubject ? followSubject : out.subject;
    const hooks = Array.isArray(out.hooks_used) ? out.hooks_used.slice(0, 6) : [];

    // ── 7. Save (no Gmail draft, no sending) ──
    await base44.entities.CampaignRecipient.update(recipient_id, {
      status: 'drafted',
      draft_subject: subject,
      draft_body: out.body,
      drafted_at: new Date().toISOString(),
      thin_context: !brief.rich,
      draft_context: brief.text.slice(0, 12000),
      draft_hooks: hooks,
      draft_concerns: out.concerns || '',
      ...(brief.name && !recipient.name ? { name: brief.name } : {}),
      ...(feedback ? { feedback_note: feedback } : {}),
      error_message: null,
    });

    return Response.json({ success: true, recipient_id, subject, body: out.body, hooks_used: hooks, concerns: out.concerns || '', thin_context: !brief.rich });
  } catch (error) {
    console.error('[generateCampaignDraft] Error:', (error as any)?.message, (error as any)?.stack);
    return Response.json({ error: (error as any)?.message }, { status: 500 });
  }
});
