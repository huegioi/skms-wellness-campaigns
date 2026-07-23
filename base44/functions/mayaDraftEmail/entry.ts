import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const { record_type, record_id, strategic_insights, sender_override, cc_emails } = body;
    if (!record_type || !record_id || !strategic_insights) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Single bundle call: record + knowledge + persona ──
    const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
    const bundleRes = await base44.functions.invoke('mayaContext', {
      action: 'bundle',
      record_type, record_id,
      categories: ['sales_process', 'products', 'positioning'],
      internal_key: _ik,
    });
    const bd = bundleRes.data || {};
    const contextText = bd.recordText || '';
    const recipientEmail = bd.recipientEmail || '';
    const recipientName = bd.recipientName || '';
    const owner = bd.owner || '';
    const knowledgeText = bd.knowledgeText || '';
    const MAYA_PERSONA = bd.persona || '';

    const contextWarnings = [];
    if (!contextText || bundleRes.status !== 200) {
      contextWarnings.push(`⚠ I couldn't load the record data (context service returned ${bundleRes.status}${bd.error ? ': ' + bd.error : ''})`);
    }
    if (!knowledgeText) {
      contextWarnings.push(`⚠ I couldn't load the knowledge base`);
    }
    if (!MAYA_PERSONA) {
      contextWarnings.push(`⚠ I couldn't load the persona`);
    }

    if (!recipientEmail) {
      return Response.json({ error: 'No recipient email on record' + (contextWarnings.length ? ' (' + contextWarnings.join('; ') + ')' : '') }, { status: 400 });
    }

    const fullContext = knowledgeText + '\n\n---\n\n' + contextText;

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}`;

    const userMessage = `RECORD CONTEXT (includes email history, interactions, proposals, and delivery data):
${fullContext}

STRATEGIC OBJECTIVE (Maya's Layer 2 advice already generated):
${strategic_insights}

TASK: Write a highly personalized, natural, and persuasive email to ${recipientName} executing this exact strategic objective. Use the email history and internal notes in the context above so you do not repeat yourself and you reference relevant details. Write in Maya's voice (warm, professional, direct).

CRITICAL EMAIL RULES:
1. Short & Punchy: Keep the email under 120 words.
2. No Hyphens/Bullets: Do NOT use bullet points, numbered lists, or excessive hyphens. Write normal paragraphs (1-3 sentences max per paragraph).
3. Singular CTA: End with ONE clear, low-friction question or call to action.
4. Formatting: Output strictly as a JSON object with two keys: "subject" and "body". Do not include any markdown.`;

    let rawText;
    try {
      const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${userMessage}`,
        model: 'claude_sonnet_4_6',
      });
      rawText = typeof llmResult === 'string' ? llmResult : '';
    } catch (llmErr) {
      console.error('[mayaDraftEmail] LLM call failed:', llmErr.message, llmErr.stack);
      return Response.json({ error: 'Maya hit an upstream error while drafting — please try again.' }, { status: 500 });
    }

    let subject = '';
    let emailBody = '';
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      subject = parsed.subject || '';
      emailBody = parsed.body || '';
    } catch (e) {
      console.error('Failed to parse JSON from LLM:', rawText);
      return Response.json({ error: 'Maya returned invalid JSON. Please try again.' }, { status: 500 });
    }

    if (contextWarnings.length > 0) {
      emailBody = contextWarnings.join('\n') + '\n\n' + emailBody;
    }

    // Determine sender: explicit override takes priority, then falls back to record owner
    const senderKey = sender_override
      ? sender_override.toLowerCase()
      : (owner || '').toLowerCase().includes('heather') ? 'heather' : 'william';
    const sender = senderKey.includes('heather') ? 'heather' : 'william';

    // Delegate MIME building + Gmail draft creation to gmailCreateDraft
    const draftRes = await base44.functions.invoke('gmailCreateDraft', {
      internal_key: _ik,
      sender,
      to: recipientEmail,
      cc: cc_emails || [],
      subject,
      body: emailBody,
      ...(record_type === 'client' ? { client_id: record_id } : { lead_id: record_id }),
    });

    if (draftRes.status !== 200 || draftRes.data?.error) {
      const errMsg = draftRes.data?.error || `gmailCreateDraft returned status ${draftRes.status}`;
      return Response.json({ error: errMsg }, { status: draftRes.status || 500 });
    }

    const fromEmail = sender === 'heather' ? 'heather@skillfulmeans.life' : 'william@skillfulmeans.life';

    return Response.json({
      success: true,
      subject,
      body: emailBody,
      email_log_id: draftRes.data.email_log_id,
      gmail_draft_id: draftRes.data.gmail_draft_id,
      from_email: fromEmail,
      to_email: recipientEmail,
    });

  } catch (error) {
    console.error('Unhandled error in mayaDraftEmail:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});