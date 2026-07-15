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

    const { record_type, record_id, strategic_insights, sender_override } = body;
    if (!record_type || !record_id || !strategic_insights) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Use shared context builder (invoked as backend function) ──
    const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
    const ctxResponse = await base44.functions.invoke('mayaContext', { action: 'record', record_type, record_id, internal_key: _ik });
    const { contextText, recipientEmail, recipientName, owner } = ctxResponse.data;

    if (!recipientEmail) {
      return Response.json({ error: 'No recipient email on record' }, { status: 400 });
    }

    // ── Fetch Maya knowledge base + persona in parallel ──
    const [knowledgeResponse, personaResponse] = await Promise.all([
      base44.functions.invoke('mayaContext', { action: 'knowledge', categories: ['sales_process', 'products', 'positioning'], internal_key: _ik }),
      base44.functions.invoke('mayaContext', { action: 'persona', internal_key: _ik }),
    ]);
    const knowledgeText = knowledgeResponse.data.contextText || '';
    const MAYA_PERSONA = personaResponse.data.persona || '';
    const fullContext = knowledgeText + '\n\n---\n\n' + contextText;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 });

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

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errText);
      return Response.json({ error: `Anthropic API error ${anthropicResponse.status}: ${errText}` }, { status: 500 });
    }

    const data = await anthropicResponse.json();
    const rawText = data.content?.[0]?.text || '';

    let subject = '';
    let emailBody = '';
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      subject = parsed.subject || '';
      emailBody = parsed.body || '';
    } catch (e) {
      console.error('Failed to parse JSON from Claude:', rawText);
      return Response.json({ error: 'Claude returned invalid JSON. Please try again.' }, { status: 500 });
    }

    // Determine sender: explicit override takes priority, then falls back to record owner
    const senderKey = sender_override
      ? sender_override.toLowerCase()
      : owner.toLowerCase().includes('heather') ? 'heather' : 'william';
    const isHeather = senderKey.includes('heather');
    const fromEmail = isHeather ? 'heather@skillfulmeans.life' : 'william@skillfulmeans.life';

    const HEATHER_GMAIL_CONNECTOR_ID = 'PASTE_HEATHER_CONNECTOR_ID_HERE';
    const connectorName = isHeather ? HEATHER_GMAIL_CONNECTOR_ID : 'gmail';
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection(connectorName);
      accessToken = conn.accessToken;
    } catch (e) {
      const who = isHeather ? "Heather's" : "William's";
      return Response.json(
        { error: `${who} Gmail isn't connected — add it in Settings → OAuth Connectors` },
        { status: 400 }
      );
    }

    const mimeLines = [
      `From: ${fromEmail}`,
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `MIME-Version: 1.0`,
      ``,
      emailBody,
    ];
    const rawMime = mimeLines.join('\r\n');

    const encoder = new TextEncoder();
    const bytes = encoder.encode(rawMime);
    let base64 = btoa(String.fromCharCode(...bytes));
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw: base64 } }),
    });

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error('Gmail API error:', gmailRes.status, errText);
      return Response.json({ error: `Gmail API error ${gmailRes.status}: ${errText}` }, { status: 500 });
    }

    const gmailDraft = await gmailRes.json();
    const gmailDraftId = gmailDraft.id;
    const gmailMessageId = gmailDraft.message?.id;

    const emailLogRecord = await base44.asServiceRole.entities.EmailLog.create({
      is_draft: true,
      gmail_message_id: gmailDraftId,
      from_email: fromEmail,
      to_email: recipientEmail,
      subject: subject,
      body_preview: emailBody.slice(0, 500),
      snippet: emailBody.slice(0, 200),
      date: new Date().toISOString(),
      direction: 'outbound',
      gmail_account: isHeather ? 'heather' : 'william',
      ...(record_type === 'client' ? { matched_client_id: record_id } : { matched_lead_id: record_id }),
    });

    return Response.json({
      success: true,
      subject,
      body: emailBody,
      email_log_id: emailLogRecord.id,
      gmail_draft_id: gmailDraftId,
      from_email: fromEmail,
      to_email: recipientEmail,
    });

  } catch (error) {
    console.error('Unhandled error in mayaDraftEmail:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});