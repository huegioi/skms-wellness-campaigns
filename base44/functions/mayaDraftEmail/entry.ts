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

    const daysSince = (d) => d ? Math.round((Date.now() - new Date(d)) / 86400000) : null;

    let contextText = '';
    let recipientEmail = '';
    let recipientName = '';
    let owner = '';

    if (record_type === 'partner') {
      let lead;
      try {
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: record_id });
        lead = leads[0];
      } catch (e) { /* not found */ }
      if (!lead) return Response.json({ error: 'Partner not found' }, { status: 404 });

      const partners = await base44.asServiceRole.entities.ReferralPartner.list();
      const matchedPartner = partners.find(p =>
        p.email?.toLowerCase() === lead.email?.toLowerCase() ||
        p.name?.toLowerCase() === lead.name?.toLowerCase()
      );

      const referrals = matchedPartner
        ? await base44.asServiceRole.entities.Referral.filter({ referral_partner_id: matchedPartner.id })
        : [];

      recipientEmail = lead.email;
      recipientName = lead.name;
      owner = lead.owner || matchedPartner?.owner || 'William';

      contextText = `PARTNER RECORD:
Name: ${lead.name}
Company: ${lead.company || 'Unknown'}
Tier: ${matchedPartner?.tier || lead.referral_potential || 'Unknown'}
Partner Status: ${lead.partner_status || 'Unknown'}
Pipeline Stage: ${lead.follow_up_stage || 'No stage set'}
Last Contacted: ${lead.last_contacted_date ? `${new Date(lead.last_contacted_date).toLocaleDateString()} (${daysSince(lead.last_contacted_date)} days ago)` : 'Never'}
Last Referral: ${lead.last_referral_date ? `${new Date(lead.last_referral_date).toLocaleDateString()} (${daysSince(lead.last_referral_date)} days ago)` : 'None'}
Total Referrals: ${lead.referral_count || 0}
YTD Revenue from Partner: $${(matchedPartner?.ytd_revenue || 0).toLocaleString()}
Renewal Cohort: ${matchedPartner?.renewal_cohort || 'Unknown'}

RECENT REFERRALS (${referrals.length} total):
${referrals.slice(0, 5).map(r => `- ${r.company_name || r.contact_name} | Status: ${r.status} | Revenue: $${(r.first_year_revenue || 0).toLocaleString()} | Date: ${r.referral_date ? new Date(r.referral_date).toLocaleDateString() : 'Unknown'}`).join('\n') || 'No referrals yet'}

NOTES: ${lead.notes || 'None'}`;

    } else if (record_type === 'client') {
      let client;
      try {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: record_id });
        client = clients[0];
      } catch (e) { /* not found */ }
      if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

      const [proposals, interactions] = await Promise.all([
        base44.asServiceRole.entities.Proposal.list('-created_date'),
        base44.asServiceRole.entities.ClientInteraction.filter({ client_id: client.id }, '-date'),
      ]);

      const clientProposals = proposals.filter(p => p.client_id === client.id);
      const acceptedValue = clientProposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.total_amount || 0), 0);

      recipientEmail = client.email;
      recipientName = client.name;
      owner = client.owner || 'William';

      contextText = `CLIENT RECORD:
Name: ${client.company || client.name}
Primary Contact: ${client.name}${client.title ? ` (${client.title})` : ''}
Industry: ${client.industry || 'Unknown'}
Company Size: ${client.company_size || 'Unknown'}
Client Stage: ${client.client_stage || 'Unknown'}
Tier: ${client.tier || 'Not set'}
Renewal Cohort: ${client.renewal_cohort || 'Not set'}
Plan Year Start: ${client.plan_year_start || 'Not set'}
Last Contacted: ${client.last_contacted_date ? `${new Date(client.last_contacted_date).toLocaleDateString()} (${daysSince(client.last_contacted_date)} days ago)` : 'Unknown'}
Last Service Date: ${client.last_service_date || 'Not set'}
Wellness Budget: ${client.wellness_budget ? `$${client.wellness_budget.toLocaleString()}` : 'Unknown'}
Referral Partner: ${client.referral_partner_name || 'None'}
Owner: ${client.owner || 'Unassigned'}

PROPOSAL SUMMARY:
Accepted Value: $${acceptedValue.toLocaleString()}
Total QB Invoice Value: $${(client.total_invoice_value || 0).toLocaleString()}
Latest Proposal Status: ${clientProposals[0]?.status || 'None'}

RECENT ACTIVITY (last 5 interactions):
${interactions.slice(0, 5).map(i => `- ${i.interaction_type} on ${new Date(i.date).toLocaleDateString()}: ${i.subject || ''} ${i.notes ? `| ${i.notes.slice(0, 80)}` : ''}`).join('\n') || 'No logged interactions'}

NOTES: ${client.notes || 'None'}`;

    } else {
      return Response.json({ error: 'Invalid record_type' }, { status: 400 });
    }

    // Fetch recent email history
    let emailLogs = [];
    try {
      if (recipientEmail) {
        const logs = await base44.asServiceRole.entities.EmailLog.filter({ to_email: recipientEmail }, '-date', 5);
        const sentLogs = await base44.asServiceRole.entities.EmailLog.filter({ from_email: recipientEmail }, '-date', 5);
        const combined = [...logs, ...sentLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        emailLogs = combined;
      }
    } catch (e) {
      console.log('Could not fetch email logs:', e.message);
    }

    const emailHistory = emailLogs.length > 0
      ? emailLogs.map(e => `[${e.direction === 'outbound' ? 'WE SENT' : 'THEY SENT'} - ${new Date(e.date).toLocaleDateString()}]
Subject: ${e.subject || '(no subject)'}
${e.body_preview || e.snippet || '(no preview available)'}`).join('\n\n---\n\n')
      : 'No previous email history found.';

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

    const userMessage = `CLIENT/PARTNER DATA:
${contextText}

RECENT EMAIL CONVERSATION HISTORY:
${emailHistory}

STRATEGIC OBJECTIVE (Maya's Layer 2 advice already generated):
${strategic_insights}

TASK: Write a highly personalized, natural, and persuasive email to ${recipientName} executing this exact strategic objective based on our previous conversation history. The email should be written in Maya's voice as if sent by ${owner} at SKMS Wellness (warm, professional, direct). Do not repeat topics already covered in recent emails unless following up on them. Make it feel like a natural continuation of the relationship.

Output the response strictly as a JSON object with exactly two keys: "subject" and "body". The body should be plain text (no HTML). Do not include any markdown formatting, code fences, or extra text outside the JSON object.`;

    console.log('Calling Anthropic API for email draft...');

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
      // Strip markdown code fences if present
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

    // Get Gmail OAuth access token (shared connector — builder's account)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Build RFC 2822 MIME message
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

    // Base64url encode (Gmail API requirement)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(rawMime);
    let base64 = btoa(String.fromCharCode(...bytes));
    // Convert to base64url
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Push draft to Gmail API
    console.log('Creating Gmail draft via API...');
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
    console.log('Gmail draft created:', gmailDraftId, 'message id:', gmailMessageId);

    // Save to EmailLog with the real Gmail IDs
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

    console.log('Email draft saved to EmailLog:', emailLogRecord.id);

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