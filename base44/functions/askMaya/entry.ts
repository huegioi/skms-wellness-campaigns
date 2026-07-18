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

// ── Name resolution: find record references in the question ────────────────

const NAME_STOP_WORDS = new Set([
  'The', 'What', 'How', 'When', 'Where', 'Who', 'Why', 'Can', 'Did', 'Does',
  'Is', 'Are', 'Was', 'Were', 'Will', 'Would', 'Should', 'Could', 'Maya',
  'She', 'He', 'They', 'This', 'That', 'These', 'Those', 'Today', 'Yesterday',
  'Tomorrow', 'William', 'Heather', 'Also', 'Then', 'Next', 'Last', 'First',
  'Some', 'Any', 'All', 'Both', 'Each', 'Every', 'Few', 'More', 'Most',
  'Other', 'Such', 'Only', 'Same', 'Than', 'Too', 'Very', 'Just', 'But',
  'For', 'And', 'Or', 'If', 'While', 'About', 'After', 'Before', 'Between',
  'Into', 'Through', 'During', 'Above', 'Below', 'From', 'Over', 'Under',
  'Again', 'Once', 'Tell', 'Give', 'Show', 'Let', 'Want', 'Need', 'Know',
  'Think', 'Look', 'Take', 'Make', 'Check', 'Review', 'Send', 'Draft', 'Write',
]);

function extractNameCandidates(question) {
  const candidates = [];
  const seen = new Set();

  // Multi-word capitalized phrases (e.g. "Silver Hill", "Jeff Coleman")
  const multiRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let m;
  while ((m = multiRegex.exec(question)) !== null) {
    const phrase = m[1];
    if (!seen.has(phrase.toLowerCase())) {
      seen.add(phrase.toLowerCase());
      candidates.push({ phrase, isMultiWord: true });
    }
  }

  // Single capitalized words (≥4 chars, excluding stop words and words already part of a multi-word phrase)
  const singleRegex = /\b([A-Z][a-z]{3,})\b/g;
  while ((m = singleRegex.exec(question)) !== null) {
    const word = m[1];
    if (NAME_STOP_WORDS.has(word) || seen.has(word.toLowerCase())) continue;
    const isPartOfMultiWord = candidates.some(c => c.isMultiWord && c.phrase.toLowerCase().includes(word.toLowerCase()));
    if (isPartOfMultiWord) continue;
    seen.add(word.toLowerCase());
    candidates.push({ phrase: word, isMultiWord: false });
  }

  return candidates;
}

function findMatchingRecords(candidates, clients, leads, partners) {
  const allRecords = [
    ...clients.map(c => ({ id: c.id, type: 'client', displayName: c.company || c.name, name: c.name, company: c.company })),
    ...leads.map(l => ({ id: l.id, type: 'lead', displayName: l.company || l.name, name: l.name, company: l.company })),
    ...partners.map(p => ({ id: p.id, type: 'partner', displayName: p.company || p.name, name: p.name, company: p.company })),
  ];

  const matches = [];
  const matchedRecordIds = new Set();
  const unmatchedPhrases = [];

  for (const { phrase, isMultiWord } of candidates) {
    const pl = phrase.toLowerCase();
    let found = null;

    for (const rec of allRecords) {
      if (matchedRecordIds.has(rec.id)) continue;
      const nl = (rec.name || '').toLowerCase();
      const cl = (rec.company || '').toLowerCase();

      const nameMatch = nl.length >= 3 && (nl.includes(pl) || pl.includes(nl));
      const companyMatch = cl.length >= 3 && (cl.includes(pl) || pl.includes(cl));

      if (nameMatch || companyMatch) {
        found = rec;
        break;
      }
    }

    if (found) {
      matches.push({ type: found.type, id: found.id, displayName: found.displayName, phrase });
      matchedRecordIds.add(found.id);
    } else if (isMultiWord) {
      unmatchedPhrases.push(phrase);
    }
  }

  return { matches: matches.slice(0, 2), unmatchedPhrases };
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

    // ── Single bundle call: global + knowledge + persona + record (if any) ──
    const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
    const bundleRes = await base44.functions.invoke('mayaContext', {
      action: 'bundle',
      include_global: true,
      record_type: hasRecord ? record_type : undefined,
      record_id: hasRecord ? record_id : undefined,
      categories: knowledgeCategories,
      question,
      internal_key: _ik,
    });
    const bd = bundleRes.data || {};

    const contextWarnings = [];
    if (!bd.globalText || bundleRes.status !== 200) {
      contextWarnings.push(`⚠ I couldn't load the global context (context service returned ${bundleRes.status})`);
    }
    if (!bd.knowledgeText) {
      contextWarnings.push(`⚠ I couldn't load the knowledge base`);
    }
    if (!bd.persona) {
      contextWarnings.push(`⚠ I couldn't load the persona`);
    }
    if (hasRecord && !bd.recordText) {
      contextWarnings.push(`⚠ I couldn't load the record data`);
    }

    const globalText = bd.globalText || '';
    const globalData = bd.globalData || {};
    const knowledgeText = bd.knowledgeText || '';
    const MAYA_PERSONA = bd.persona || '';
    const recordText = hasRecord ? (bd.recordText || '') : '';

    // ── Name resolution: find record references in the question ──
    let groundedNames = [];
    let unmatchedNames = [];
    let matchedRecordBlocks = [];

    if (!hasRecord) {
      const allClients = globalData.clients || [];
      const allLeads = globalData.leads || [];
      const allPartners = globalData.partners || [];

      const candidates = extractNameCandidates(question);
      const { matches, unmatchedPhrases } = findMatchingRecords(candidates, allClients, allLeads, allPartners);
      unmatchedNames = unmatchedPhrases;

      if (matches.length > 0) {
        const recordFetches = matches.map(m =>
          base44.functions.invoke('mayaContext', { action: 'record', record_type: m.type, record_id: m.id, internal_key: _ik })
        );
        const recordResponses = await Promise.all(recordFetches);

        matchedRecordBlocks = matches.map((m, i) => {
          const ctx = recordResponses[i].data?.contextText || '';
          if (!ctx || recordResponses[i].data?.error || recordResponses[i].status !== 200) {
            contextWarnings.push(`⚠ I couldn't load the record data for ${m.displayName} (context service returned ${recordResponses[i].status})`);
            return null;
          }
          return { displayName: m.displayName, type: m.type, contextText: ctx };
        }).filter(Boolean);

        groundedNames = matchedRecordBlocks.map(b => b.displayName);
      }
    }

    const sections = [];
    if (recordText) sections.push(recordText);
    if (matchedRecordBlocks.length > 0) {
      sections.push(`MATCHED RECORDS (resolved from your question):\n${matchedRecordBlocks.map((b, i) => `${i+1}. ${b.displayName} (${b.type})`).join('\n')}`);
      for (const b of matchedRecordBlocks) {
        sections.push(`RECORD: ${b.displayName} (${b.type})\n${b.contextText}`);
      }
    }
    sections.push(knowledgeText);
    sections.push(globalText);
    const fullContext = sections.filter(Boolean).join('\n\n---\n\n');

    const unmatchedNote = unmatchedNames.length > 0
      ? `\n\nNOTE: The following name-like phrases in the question did not match any Client, Lead, or Referral Partner record: ${unmatchedNames.map(n => `"${n}"`).join(', ')}. Tell the user you couldn't find a record for these names rather than answering generically.`
      : '';

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `[SYSTEM NOTE: Today's date is ${currentDate}.]

${MAYA_PERSONA}

ANSWER MODE
You are answering a direct question from William or Heather. Ground every answer in the provided context and name the evidence ('proposal viewed twice, no touch in 9 days'). If the question is about how to do something in the platform or where something is, use the platform_help knowledge to give concrete, accurate steps. If the needed context is missing, say what you'd need rather than guessing. Never invent services, prices, contacts, or history. Be concise and specific — a tight bullet list or 2–4 short paragraphs. Never imply you sent or did anything yourself.`;

    let llmResult;
    try {
      llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${fullContext}${unmatchedNote}\n\n---\n\nQUESTION:\n${question}`,
        model: 'gpt_5_mini',
      });
    } catch (llmErr) {
      console.error('[askMaya] LLM call failed:', llmErr.message, llmErr.stack);
      return Response.json({ answer: 'Maya hit an upstream error — please try again in a moment.' + FOOTER, help_mode: helpMode });
    }

    const groundedFooter = groundedNames.length > 0 ? `\n\n_Grounded on: ${groundedNames.join(', ')}_` : '';
    const answer = (typeof llmResult === 'string' ? llmResult : '') + FOOTER + groundedFooter;
    const warningPrefix = contextWarnings.length > 0 ? contextWarnings.join('\n') + '\n\n' : '';

    return Response.json({ answer: warningPrefix + answer, help_mode: helpMode });
  } catch (error) {
    console.error('Unhandled error in askMaya:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});