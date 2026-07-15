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

    const contextWarnings = [];
    if (!responses[0].data?.contextText || responses[0].data?.error || responses[0].status !== 200) {
      contextWarnings.push(`⚠ I couldn't load the global context (context service returned ${responses[0].status})`);
    }
    if (!responses[1].data?.contextText || responses[1].data?.error) {
      contextWarnings.push(`⚠ I couldn't load the knowledge base (context service returned ${responses[1].status})`);
    }
    if (!responses[2].data?.persona || responses[2].data?.error) {
      contextWarnings.push(`⚠ I couldn't load the persona (context service returned ${responses[2].status})`);
    }
    if (hasRecord && (!responses[3].data?.contextText || responses[3].data?.error || responses[3].status !== 200)) {
      contextWarnings.push(`⚠ I couldn't load the record data (context service returned ${responses[3].status})`);
    }

    const globalText = responses[0].data?.contextText || '';
    const knowledgeText = responses[1].data?.contextText || '';
    const MAYA_PERSONA = responses[2].data?.persona || '';
    const recordText = hasRecord ? (responses[3].data?.contextText || '') : '';

    const sections = [];
    if (recordText) sections.push(recordText);
    sections.push(knowledgeText);
    sections.push(globalText);
    const fullContext = sections.filter(Boolean).join('\n\n---\n\n');

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}

ANSWER MODE
You are answering a direct question from William or Heather. Ground every answer in the provided context and name the evidence ('proposal viewed twice, no touch in 9 days'). If the question is about how to do something in the platform or where something is, use the platform_help knowledge to give concrete, accurate steps. If the needed context is missing, say what you'd need rather than guessing. Never invent services, prices, contacts, or history. Be concise and specific — a tight bullet list or 2–4 short paragraphs. Never imply you sent or did anything yourself.`;

    let llmResult;
    try {
      llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${fullContext}\n\n---\n\nQUESTION:\n${question}`,
        model: 'claude_sonnet_4_6',
      });
    } catch (llmErr) {
      console.error('[askMaya] LLM call failed:', llmErr.message, llmErr.stack);
      return Response.json({ answer: 'Maya hit an upstream error — please try again in a moment.' + FOOTER, help_mode: helpMode });
    }

    const answer = (typeof llmResult === 'string' ? llmResult : '') + FOOTER;
    const warningPrefix = contextWarnings.length > 0 ? contextWarnings.join('\n') + '\n\n' : '';

    return Response.json({ answer: warningPrefix + answer, help_mode: helpMode });
  } catch (error) {
    console.error('Unhandled error in askMaya:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});