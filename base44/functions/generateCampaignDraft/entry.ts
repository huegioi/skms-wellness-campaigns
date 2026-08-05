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

    // ── Calls-to-action snapshot (campaign.selected_ctas) ──
    // When empty/absent, ctaBlock is '' and the prompt is byte-identical to before.
    const selectedCtas = Array.isArray(campaign.selected_ctas) ? campaign.selected_ctas : [];
    const ctaBlock = selectedCtas.length > 0
      ? `CALLS TO ACTION (selected for this campaign — weave in at most two):
${selectedCtas.map(c => `- "${c.label || ''}" → ${c.url || ''}${c.guidance ? ` (guidance: ${c.guidance})` : ''}`).join('\n')}
- Weave in AT MOST TWO of the above CTAs, chosen for fit with this recipient's context.
- Each CTA should read as a natural sentence with the URL as a plain link (no link dumps, no bullet list of links).
- If a demo-call or scheduling CTA is selected, it should usually be the closing ask.

`
      : '';

    // ── 3. Build LLM prompt: SKELETON + PERSONAL TOUCHES ──
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}`;

    const userMessage = `CAMPAIGN EMAIL SKELETON (preserve structure, key points, and call-to-action):
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