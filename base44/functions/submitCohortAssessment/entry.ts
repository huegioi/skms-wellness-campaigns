import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { clientIsDemoOrInternal } from '../../shared/demoClient.ts';

// ── Scoring helpers ──────────────────────────────────────────────

const INSTRUMENT_DEFS = {
  who5: {
    items: ['q1', 'q2', 'q3', 'q4', 'q5'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 5,
    score: (r) => (r.q1 + r.q2 + r.q3 + r.q4 + r.q5) * 4, // 0-100
  },
  enps: {
    items: ['q1'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 10,
    score: (r) => r.q1, // raw 0-10
  },
  uwes3: {
    items: ['q1', 'q2', 'q3'],
    validate: (v) => typeof v === 'number' && v >= 0 && v <= 6,
    score: (r) => Math.round(((r.q1 + r.q2 + r.q3) / 3) * 100) / 100, // mean, 0-6
  },
  pss4: {
    items: ['q1', 'q2', 'q3', 'q4'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 4,
    score: (r) => r.q1 + (4 - r.q2) + (4 - r.q3) + r.q4, // items 2,3 reverse-scored → 0-16
  },
  ucla3: {
    items: ['q1', 'q2', 'q3'],
    validate: (v) => Number.isInteger(v) && v >= 1 && v <= 3,
    score: (r) => r.q1 + r.q2 + r.q3, // 3-9
  },
  cbi: {
    items: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 4,
    score: (r) => {
      const vals = [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6];
      const rescaled = vals.map(v => v * 25); // 0→0, 1→25, 2→50, 3→75, 4→100
      return Math.round(rescaled.reduce((a, b) => a + b, 0) / rescaled.length * 100) / 100;
    },
  },
};

// ── Handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const {
    client_id,
    service_id,
    proposal_id,
    event_id,
    participant_email,
    participant_phone,
    survey_type,
    instrument,
    item_responses,
    assessment_phase = 'Phase 2',
    // Legacy WHO-5 individual fields
    who5_cheerful,
    who5_calm,
    who5_active,
    who5_rested,
    who5_interested,
  } = body;

  // Validate required fields
  if (!participant_email || !survey_type) {
    return Response.json({ error: 'participant_email and survey_type are required' }, { status: 400 });
  }

  const validSurveyTypes = ['challenge_day0', 'challenge_day14', 'cohort_start', 'cohort_end', 'cohort_1mo'];
  if (!validSurveyTypes.includes(survey_type)) {
    return Response.json({ error: 'Invalid survey_type' }, { status: 400 });
  }

  const normalizedEmail = participant_email.toLowerCase().trim();
  const submitted_at = new Date().toISOString();

  // Stamp is_demo when the owning client is demo or internal, so test survey
  // runs never pollute admin analytics.
  const stampIsDemo = await clientIsDemoOrInternal(base44, client_id);

  // cohort_year: stamp from the linked CalendarEvent's start_date year when an
  // event_id is available (matching the check-in path); else fall back to now.
  let cohort_year = new Date().getFullYear();
  if (event_id) {
    try {
      const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
      if (events[0]?.start_date) cohort_year = new Date(events[0].start_date).getFullYear();
    } catch { /* fall back to submission year */ }
  }

  // ── Determine path: new generic instrument OR legacy WHO-5 fields ──

  const isLegacyWho5 = !instrument && who5_cheerful !== undefined;
  const effectiveInstrument = instrument || (isLegacyWho5 ? 'who5' : null);

  if (!effectiveInstrument) {
    return Response.json({ error: 'instrument is required (or provide legacy who5_* fields)' }, { status: 400 });
  }

  const def = INSTRUMENT_DEFS[effectiveInstrument];
  if (!def) {
    return Response.json({ error: `Unknown instrument: ${effectiveInstrument}` }, { status: 400 });
  }

  let finalItemResponses;
  let who5Fields = {};

  if (isLegacyWho5) {
    // ── Legacy WHO-5 path (unchanged behavior) ──
    const scores = { who5_cheerful, who5_calm, who5_active, who5_rested, who5_interested };
    for (const [key, val] of Object.entries(scores)) {
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 0 || n > 5) {
        return Response.json({ error: `${key} must be an integer between 0 and 5` }, { status: 400 });
      }
      scores[key] = n;
    }
    who5Fields = scores;
    who5Fields.who5_total = (scores.who5_cheerful + scores.who5_calm + scores.who5_active + scores.who5_rested + scores.who5_interested) * 4;
    finalItemResponses = {
      q1: scores.who5_cheerful,
      q2: scores.who5_calm,
      q3: scores.who5_active,
      q4: scores.who5_rested,
      q5: scores.who5_interested,
    };
  } else {
    // ── Generic instrument path ──
    if (!item_responses || typeof item_responses !== 'object') {
      return Response.json({ error: 'item_responses object is required' }, { status: 400 });
    }
    for (const key of def.items) {
      if (item_responses[key] === undefined || item_responses[key] === null) {
        return Response.json({ error: `Missing item_responses.${key} for ${effectiveInstrument}` }, { status: 400 });
      }
      const v = typeof item_responses[key] === 'string' ? Number(item_responses[key]) : item_responses[key];
      if (!def.validate(v)) {
        return Response.json({ error: `Invalid value for item_responses.${key}` }, { status: 400 });
      }
      item_responses[key] = v;
    }
    finalItemResponses = item_responses;

    // If generic who5, also populate legacy columns for back-compat
    if (effectiveInstrument === 'who5') {
      who5Fields = {
        who5_cheerful: item_responses.q1,
        who5_calm: item_responses.q2,
        who5_active: item_responses.q3,
        who5_rested: item_responses.q4,
        who5_interested: item_responses.q5,
      };
      who5Fields.who5_total = (item_responses.q1 + item_responses.q2 + item_responses.q3 + item_responses.q4 + item_responses.q5) * 4;
    }
  }

  const instrument_total = def.score(finalItemResponses);

  const record = {
    client_id: client_id || null,
    service_id: service_id || null,
    proposal_id: proposal_id || null,
    event_id: event_id || null,
    participant_email: normalizedEmail,
    participant_phone: participant_phone || null,
    survey_type,
    instrument: effectiveInstrument,
    instrument_total,
    item_responses: finalItemResponses,
    ...who5Fields,
    cohort_year,
    submitted_at,
    assessment_phase,
    is_demo: stampIsDemo,
  };

  // ── Dedup (update-in-place on duplicate) ────────────────────────────────────
  // baseline types (cohort_start, challenge_day0): email + client_id + survey_type + cohort_year
  // end/session types WITH event_id: email + event_id + survey_type
  // end types WITHOUT event_id: email + client_id + survey_type + cohort_year
  const isBaseline = survey_type === 'cohort_start' || survey_type === 'challenge_day0';
  // instrument MUST be in the dedup key: a baseline battery submits one row PER
  // instrument (who5, uwes3, ...) sharing email+survey_type+cohort_year — without
  // it, the second instrument would overwrite the first's row.
  const dedupFilter = { participant_email: normalizedEmail, survey_type, instrument: effectiveInstrument };
  if (isBaseline || !event_id) {
    dedupFilter.cohort_year = cohort_year;
    if (client_id) dedupFilter.client_id = client_id;
  } else {
    dedupFilter.event_id = event_id;
  }

  const existing = await base44.asServiceRole.entities.CohortAssessment.filter(dedupFilter);
  if (existing.length > 0) {
    const existingRow = existing[0];
    await base44.asServiceRole.entities.CohortAssessment.update(existingRow.id, {
      instrument_total,
      item_responses: finalItemResponses,
      ...who5Fields,
      cohort_year,
      event_id: event_id || existingRow.event_id || null,
      submitted_at,
      assessment_phase,
    });
    return Response.json({ success: true, id: existingRow.id, updated: true, instrument: effectiveInstrument, instrument_total, cohort_year });
  }

  const created = await base44.asServiceRole.entities.CohortAssessment.create(record);

  return Response.json({ success: true, id: created.id, instrument: effectiveInstrument, instrument_total, cohort_year });
});