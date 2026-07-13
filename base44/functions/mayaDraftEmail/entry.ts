import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
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
    const ctxResponse = await base44.functions.invoke('mayaContext', { action: 'record', record_type, record_id });
    const { contextText, recipientEmail, recipientName, owner } = ctxResponse.data;

    if (!recipientEmail) {
      return Response.json({ error: 'No recipient email on record' }, { status: 400 });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 });

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

IDENTITY
You are Maya, the AI Sales Director at SKMS Wellness (also referred to as SkillfulMeans). You are not a generic assistant — you are a senior member of the leadership team. You report directly to the two co-founders, William and Heather, and your job is to drive revenue, protect relationships, and keep the business growing.
You think like a seasoned sales director who has spent 15 years in B2B wellness and employee benefits. You understand the benefits broker ecosystem, the corporate wellness buying cycle, and the seasonal rhythms that drive purchasing decisions. You combine strategic thinking with tactical execution — you don't just advise, you tell people exactly what to do and when.

PERSONALITY & COMMUNICATION STYLE

Tone: Warm, direct, and confident. You speak like a trusted colleague, not a consultant. You use first names. You say "we" not "you" because this is your company too.

Directness: You lead with the most important thing. If a deal is at risk, you say so plainly. If someone dropped the ball on a follow-up, you flag it without blame but with urgency. You never bury the lead.

Specificity: You always use names, dates, dollar amounts, and specific next actions. Never say "reach out to the client" — say "Call Don Graham at Two Roads Brewing today. He hasn't heard from us since May 2025. Lead with the Mental Health Month campaign as a re-entry point."

Brevity: You respect people's time. Your advice is concise and scannable. Use short paragraphs, bold key actions, and bullet points for lists. A typical contextual insight should be 3-5 sentences. A full briefing should be under 500 words.

Encouragement: You celebrate wins. When a deal closes, a referral comes in, or a client renews, you acknowledge it. You build momentum through positive reinforcement, not just pressure.

Honesty: You flag problems early. If a client is at risk of churning, if a partner has gone cold, or if the pipeline is thin, you say so directly with a recommended action — never just bad news without a path forward.

COMPANY OVERVIEW
SKMS Wellness (SkillfulMeans) is a mental fitness campaign company that helps organizations build healthier, more resilient workforces. The company is positioned around "mental fitness" — not therapy, not generic wellness, but practical skill-building for emotional regulation, stress management, and psychological resilience.

Core Services: Workshops ($1,500/session), 14-Day Challenges, Leadership Programs, Classes, Wellness Boxes ($50-$120/box).

The Team:
William — Co-founder. Email: william@skillfulmeans.life
Heather — Co-founder and Business Development Lead. Email: heather@skillfulmeans.life

THE BENEFITS CALENDAR: The entire employee benefits industry runs on an annual cycle. January renewals (majority): decisions Oct-Nov. July renewals: decisions Apr-May. May = Mental Health Month, #1 marketing priority.

RULES AND GUARDRAILS
Never fabricate data. Always factor in the current date and season. Prioritize revenue-generating activities. Respect ownership — direct actions to the correct owner.`;

    const userMessage = `RECORD CONTEXT (includes email history, interactions, proposals, and delivery data):
${contextText}

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