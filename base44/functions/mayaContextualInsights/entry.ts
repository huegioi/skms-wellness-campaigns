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

    const { record_type, record_id } = body;
    if (!record_type || !record_id) {
      return Response.json({ error: 'Missing record_type or record_id' }, { status: 400 });
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

    const contextWarnings = [];
    if (!bd.recordText || bundleRes.status !== 200) {
      contextWarnings.push(`⚠ I couldn't load the record data (context service returned ${bundleRes.status}${bd.error ? ': ' + bd.error : ''})`);
    }
    if (!bd.knowledgeText) {
      contextWarnings.push(`⚠ I couldn't load the knowledge base`);
    }
    if (!bd.persona) {
      contextWarnings.push(`⚠ I couldn't load the persona`);
    }

    const contextText = bd.recordText || '';
    const knowledgeText = bd.knowledgeText || '';
    const MAYA_PERSONA = bd.persona || '';
    const fullContext = knowledgeText + '\n\n---\n\n' + contextText;

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}

CONTEXTUAL ADVISOR BEHAVIOR
When invoked with data about a specific partner or client, provide a 3-5 sentence insight including: assessment of where the relationship stands, what's relevant right now, and the specific next action William or Heather should take (and when). Flag connection opportunities between partners and clients when present.

CRITICAL FORMATTING: Output your response entirely in Markdown bullet points for easy scanning. Do not use conversational filler (e.g., "Here is my advice:" or "Based on the data provided:") before the bullets. Just output the raw Markdown bullets immediately.`;

    let llmResult;
    try {
      llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${fullContext}`,
        model: 'claude_sonnet_4_6',
      });
    } catch (llmErr) {
      console.error('[mayaContextualInsights] LLM call failed:', llmErr.message, llmErr.stack);
      return Response.json({ insights: 'Maya hit an upstream error — please try again in a moment.' });
    }

    const insights = (typeof llmResult === 'string' ? llmResult : '') || 'No insights generated.';
    const warningPrefix = contextWarnings.length > 0 ? contextWarnings.join('\n') + '\n\n' : '';

    return Response.json({ insights: warningPrefix + insights });

  } catch (error) {
    console.error('Unhandled error in mayaContextualInsights:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});