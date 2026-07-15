import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════════════
// askMaya — direct Q&A with Maya.
// Input: { question, record_type?, record_id?, mode? }
// Builds context: global + record (when ids passed) + knowledge selection.
// Knowledge selection: include platform_help when the question looks like a
// how-do-I / where-is question (heuristic), otherwise sales categories.
// Answers with the shared Maya persona. Appends a verify-before-acting footer.
// ═══════════════════════════════════════════════════════════════════════════

const FOOTER = '\n\n---\n\n_Maya can be wrong — verify before acting on numbers._';

const HELP_REGEX = /\b(how do i|how to|can i|where)\b/i;

function isHelpQuestion(question, mode) {
  if (mode === 'help') return true;
  if (!question) return false;
  return HELP_REGEX.test(question);
}

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

    const { question, record_type, record_id, mode } = body;
    if (!question || typeof question !== 'string') {
      return Response.json({ error: 'Missing question' }, { status: 400 });
    }

    const helpMode = isHelpQuestion(question, mode);
    const knowledgeCategories = helpMode
      ? ['platform_help', 'sales_process', 'products']
      : ['sales_process', 'products', 'positioning', 'delivery'];

    const hasRecord = !!(record_type && record_id);

    // ── Fetch global + record (when ids) + knowledge + persona in parallel ──
    const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
    const fetches = [
      base44.functions.invoke('mayaContext', { action: 'global', internal_key: _ik }),
      base44.functions.invoke('mayaContext', { action: 'knowledge', categories: knowledgeCategories, internal_key: _ik }),
      base44.functions.invoke('mayaContext', { action: 'persona', internal_key: _ik }),
    ];
    if (hasRecord) {
      fetches.push(base44.functions.invoke('mayaContext', { action: 'record', record_type, record_id, internal_key: _ik }));
    }
    const responses = await Promise.all(fetches);

    const globalText = responses[0].data?.contextText || '';
    const knowledgeText = responses[1].data?.contextText || '';
    const MAYA_PERSONA = responses[2].data?.persona || '';
    const recordText = hasRecord ? (responses[3].data?.contextText || '') : '';

    const sections = [];
    if (recordText) sections.push(recordText);
    sections.push(knowledgeText);
    sections.push(globalText);
    const fullContext = sections.filter(Boolean).join('\n\n---\n\n');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}

ANSWER MODE
You are answering a direct question from William or Heather. Ground every answer in the provided context and name the evidence ('proposal viewed twice, no touch in 9 days'). If the question is about how to do something in the platform or where something is, use the platform_help knowledge to give concrete, accurate steps. If the needed context is missing, say what you'd need rather than guessing. Never invent services, prices, contacts, or history. Be concise and specific — a tight bullet list or 2–4 short paragraphs. Never imply you sent or did anything yourself.`;

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
        messages: [
          { role: 'user', content: fullContext + '\n\n---\n\nQUESTION:\n' + question },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errText);
      return Response.json({ error: `Anthropic API error ${anthropicResponse.status}: ${errText}` }, { status: 500 });
    }

    const data = await anthropicResponse.json();
    const answer = (data.content?.[0]?.text || 'No answer generated.') + FOOTER;

    return Response.json({ answer, help_mode: helpMode });
  } catch (error) {
    console.error('Unhandled error in askMaya:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});