import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (e) {
      user = true;
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

    // ── Fetch shared context, knowledge base, and persona in parallel ──
    const [ctxResponse, knowledgeResponse, personaResponse] = await Promise.all([
      base44.functions.invoke('mayaContext', { action: 'record', record_type, record_id }),
      base44.functions.invoke('mayaContext', { action: 'knowledge', categories: ['sales_process', 'products', 'positioning'] }),
      base44.functions.invoke('mayaContext', { action: 'persona' }),
    ]);
    const { contextText } = ctxResponse.data;
    const knowledgeText = knowledgeResponse.data.contextText || '';
    const MAYA_PERSONA = personaResponse.data.persona || '';
    const fullContext = knowledgeText + '\n\n---\n\n' + contextText;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}

CONTEXTUAL ADVISOR BEHAVIOR
When invoked with data about a specific partner or client, provide a 3-5 sentence insight including: assessment of where the relationship stands, what's relevant right now, and the specific next action William or Heather should take (and when). Flag connection opportunities between partners and clients when present.

CRITICAL FORMATTING: Output your response entirely in Markdown bullet points for easy scanning. Do not use conversational filler (e.g., "Here is my advice:" or "Based on the data provided:") before the bullets. Just output the raw Markdown bullets immediately.`;

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
          { role: 'user', content: fullContext }
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errText);
      return Response.json({ error: `Anthropic API error ${anthropicResponse.status}: ${errText}` }, { status: 500 });
    }

    const data = await anthropicResponse.json();
    const insights = data.content?.[0]?.text || 'No insights generated.';

    return Response.json({ insights });

  } catch (error) {
    console.error('Unhandled error in mayaContextualInsights:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});