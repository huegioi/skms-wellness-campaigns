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

    const { campaign_id, recipient_id, feedback } = body;
    if (!campaign_id || !recipient_id) {
      return Response.json({ error: 'Missing campaign_id or recipient_id' }, { status: 400 });
    }

    // ── 1. Load campaign and recipient; set status "drafting" ──
    const campaign = await base44.entities.OutreachCampaign.get(campaign_id);
    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const recipient = await base44.entities.CampaignRecipient.get(recipient_id);
    if (!recipient || recipient.campaign_id !== campaign_id) {
      return Response.json({ error: 'Recipient not found or does not belong to campaign' }, { status: 404 });
    }

    await base44.entities.CampaignRecipient.update(recipient_id, { status: 'drafting' });

    // ── 2. Get context via mayaContext bundle (same pattern as mayaDraftEmail) ──
    const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
    const bundleRes = await base44.functions.invoke('mayaContext', {
      action: 'bundle',
      record_type: recipient.record_type,
      record_id: recipient.record_id,
      categories: ['sales_process', 'products', 'positioning'],
      internal_key: _ik,
    });
    const bd = bundleRes.data || {};
    const recordText = bd.recordText || '';
    const knowledgeText = bd.knowledgeText || '';
    const MAYA_PERSONA = bd.persona || '';
    const hasRichContext = bd.has_rich_context === true;
    const thinContext = !hasRichContext;

    const contactName = recipient.name || bd.recipientName || '';
    const firstName = contactName.split(' ')[0] || 'there';
    const companyName = recipient.company || '';

    // ── Follow-up round detection ──
    // Rows with followup_round >= 1 get a short 2-4 sentence bump instead of
    // the full skeleton draft. Context: the original (latest sent) email's
    // subject + body + sent date, the round number, the launch's guidance,
    // and the launch's selected_ctas.
    const isFollowup = (recipient.followup_round || 0) >= 1;
    let originalEmail = null;
    let launch = null;
    if (isFollowup) {
      if (recipient.launch_id) {
        try {
          launch = await base44.entities.CampaignFollowUpLaunch.get(recipient.launch_id);
        } catch (e) { /* missing launch record — continue without it */ }
      }
      // Find the latest SENT row for this email — the message being bumped.
      const siblings = await base44.entities.CampaignRecipient.filter(
        { campaign_id },
        '-created_date',
        500
      );
      const emailKey = (recipient.email || '').toLowerCase().trim();
      const sentSiblings = siblings
        .filter(s =>
          (s.email || '').toLowerCase().trim() === emailKey &&
          s.status === 'sent' &&
          s.id !== recipient.id
        )
        .sort((a, b) =>
          ((b.followup_round || 0) - (a.followup_round || 0)) ||
          (new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime())
        );
      originalEmail = sentSiblings[0] || null;
    }

    // ── Calls-to-action snapshot ──
    // Round 1 uses campaign.selected_ctas; follow-up rounds use the launch's
    // selected_ctas snapshot.
    const selectedCtas = Array.isArray(campaign.selected_ctas) ? campaign.selected_ctas : [];
    const ctaBlock = selectedCtas.length > 0
      ? `CALLS TO ACTION (selected for this campaign — weave in at most two):
${selectedCtas.map(c => `- "${c.label || ''}" → ${c.url || ''}${c.guidance ? ` (guidance: ${c.guidance})` : ''}`).join('\n')}
- Weave in AT MOST TWO of the above CTAs, chosen for fit with this recipient's context.
- Each CTA should read as a natural sentence with the URL as a plain link (no link dumps, no bullet list of links).
- If a demo-call or scheduling CTA is selected, it should usually be the closing ask.

`
      : '';

    // ── 3. Build LLM prompt ──
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}`;

    let userMessage;

    if (isFollowup) {
      // ── Follow-up bump prompt (2-4 sentence thread reply) ──
      const origSubject = originalEmail?.draft_subject || '';
      const origBody = originalEmail?.draft_body || '';
      const origDate = originalEmail?.sent_at
        ? new Date(originalEmail.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'recently';
      const roundNum = recipient.followup_round || 1;
      const launchGuidance = launch?.guidance || '';
      const launchCtas = Array.isArray(launch?.selected_ctas) ? launch.selected_ctas : [];
      const ctaBlockFu = launchCtas.length > 0
        ? `CALLS TO ACTION (selected for this follow-up round — weave in AT MOST ONE):
${launchCtas.map(c => `- "${c.label || ''}" → ${c.url || ''}${c.guidance ? ` (guidance: ${c.guidance})` : ''}`).join('\n')}
- Weave in AT MOST ONE CTA, as a natural sentence with the URL as a plain link.
- If none fit naturally, end with a soft open question instead.

`
        : '';
      const senderName = campaign.sender_mode === 'heather' ? 'Heather'
        : campaign.sender_mode === 'william' ? 'William'
        : ((recipient.owner || '').toLowerCase().includes('heather') ? 'Heather' : 'William');

      userMessage = `FOLLOW-UP EMAIL — Round ${roundNum}. This is a gentle bump to someone who received your previous email but did not reply.

ORIGINAL EMAIL SENT (the message being bumped):
Subject: ${origSubject}
Sent: ${origDate}
Body:
${origBody}

FOLLOW-UP GUIDANCE (from the campaign operator for this round):
${launchGuidance || '(none)'}

${ctaBlockFu}CONTACT CONTEXT (record data, email history, interactions, meeting notes):
${recordText}

KNOWLEDGE BASE:
${knowledgeText}

CONTACT DETAILS:
Name: ${contactName}
First name: ${firstName}
Email: ${recipient.email || bd.recipientEmail || ''}
Company: ${companyName}

TASK: Write a short follow-up email to ${contactName}.

STYLE CONTRACT (CRITICAL):
- 2 to 4 sentences only. No longer.
- Reference the original email's topic WITHOUT repeating its content.
- Add ONE new angle or gentle nudge (a useful resource, a relevant observation, a quick question). Open with something of value — do NOT open with "just bumping this" or "following up" as the whole message.
- AT MOST ONE CTA from the selected CTAs above, woven in naturally. If none selected, end with a soft open question.
- Sign off as ${senderName} (matching the campaign's sender_mode).
- Subject MUST be "Re: " + the original subject (this will be a thread reply). Keep the same subject otherwise.

${thinContext
  ? 'THIN CONTEXT: This contact has NO interactions and NO email history in our system. Keep the bump grounded in the original email and light company-level detail only. Do NOT invent a shared history.'
  : 'THIN CONTEXT: This contact has rich context available above. Personalize naturally using the real history.'}

HARD RULES:
1. Never invent meetings, conversations, or facts not present in the provided context.
2. No bullet points, numbered lists, or hyphens used as dashes. Write normal paragraphs.
3. Output STRICTLY as a JSON object: {"subject": "...", "body": "..."}. No markdown, no code fences, no commentary.`;
    } else {
      // ── Round-1 original outreach prompt (unchanged) ──
      userMessage = `CAMPAIGN EMAIL SKELETON (preserve structure, key points, and call-to-action):
Subject template: ${campaign.subject_template || ''}
Body template:
${campaign.body_template || ''}

CAMPAIGN PERSONALIZATION NOTES:
${campaign.personalization_notes || '(none)'}

${feedback ? `REVIEWER FEEDBACK (William/Heather's correction for this specific draft — takes priority over the notes above):
${feedback}` : ''}

CONTACT CONTEXT (record data, email history, interactions, meeting notes):
${recordText}

KNOWLEDGE BASE:
${knowledgeText}

CONTACT DETAILS:
Name: ${contactName}
First name: ${firstName}
Email: ${recipient.email || bd.recipientEmail || ''}
Company: ${companyName}

TASK: Write a personalized email to ${contactName} using the SKELETON above as the base structure.

SKELETON RULES (CRITICAL):
- The body_template is the SKELETON. Its structure, key points, and call-to-action must be preserved.
- Target roughly the template's length. This OVERRIDES the 120-word rule used for one-off Maya emails.
- Replace {{first_name}} with "${firstName}". Replace {{company}} with "${companyName}". Replace any similar merge hints with real values.

PERSONAL TOUCHES:
- Personalize the greeting and opening lines with natural references to the contact's real history (last meeting, notes, their company's situation).
- Fill in every [PERSONALIZE: ...] block with real, context-grounded content.

${thinContext
  ? 'THIN CONTEXT: This contact has NO interactions and NO email history in our system. Keep the skeleton intact with light company-level personalization only (company name, industry if known). Do NOT invent a shared history.'
  : 'THIN CONTEXT: This contact has rich context available above. Personalize naturally using the real history.'}

${ctaBlock}HARD RULES:
1. Never invent meetings, conversations, or facts not present in the provided context.
2. No bullet points, numbered lists, or hyphens used as dashes. Write normal paragraphs.
3. End with exactly ONE clear call-to-action (from the skeleton).
4. Keep Maya's warm, professional, direct voice.
5. Output STRICTLY as a JSON object: {"subject": "...", "body": "..."}. No markdown, no code fences, no commentary.`;
    }

    // ── Call LLM with one retry on parse failure ──
    let subject = '';
    let emailBody = '';
    let lastError = '';

    for (let attempt = 0; attempt < 2; attempt++) {
      let rawText;
      try {
        const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `${systemPrompt}\n\n${userMessage}`,
          model: 'claude_sonnet_4_6',
        });
        rawText = typeof llmResult === 'string' ? llmResult : '';
      } catch (llmErr) {
        console.error(`[generateCampaignDraft] LLM call failed (attempt ${attempt + 1}):`, llmErr.message);
        lastError = 'LLM call failed: ' + llmErr.message;
        continue;
      }

      try {
        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        subject = parsed.subject || '';
        emailBody = parsed.body || '';
        if (subject && emailBody) break;
        lastError = 'LLM returned empty subject or body';
      } catch (e) {
        console.error(`[generateCampaignDraft] JSON parse failed (attempt ${attempt + 1}):`, rawText?.slice(0, 200));
        lastError = 'Failed to parse LLM output as JSON';
      }
    }

    if (!subject || !emailBody) {
      await base44.entities.CampaignRecipient.update(recipient_id, {
        status: 'error',
        error_message: lastError || 'LLM returned empty response',
      });
      return Response.json({ error: lastError || 'Failed to generate draft', recipient_id }, { status: 500 });
    }

    // ── 4. Save draft on recipient; NO Gmail draft, NO sending ──
    await base44.entities.CampaignRecipient.update(recipient_id, {
      status: 'drafted',
      draft_subject: subject,
      draft_body: emailBody,
      drafted_at: new Date().toISOString(),
      thin_context: thinContext,
      ...(feedback ? { feedback_note: feedback } : {}),
      error_message: null,
    });

    return Response.json({
      success: true,
      recipient_id,
      subject,
      body: emailBody,
      thin_context: thinContext,
    });
  } catch (error) {
    console.error('[generateCampaignDraft] Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});