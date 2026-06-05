import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const {
    client_id,
    service_id,
    participant_email,
    participant_phone,
    survey_type,
    who5_cheerful,
    who5_calm,
    who5_active,
    who5_rested,
    who5_interested,
    assessment_phase = 'Phase 2',
  } = body;

  // Validate required fields
  if (!participant_email || !survey_type) {
    return Response.json({ error: 'participant_email and survey_type are required' }, { status: 400 });
  }

  const validSurveyTypes = ['challenge_day0', 'challenge_day14', 'annual_baseline', 'annual_endline'];
  if (!validSurveyTypes.includes(survey_type)) {
    return Response.json({ error: 'Invalid survey_type' }, { status: 400 });
  }

  // Validate WHO-5 scores
  const scores = { who5_cheerful, who5_calm, who5_active, who5_rested, who5_interested };
  for (const [key, val] of Object.entries(scores)) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0 || n > 5) {
      return Response.json({ error: `${key} must be an integer between 0 and 5` }, { status: 400 });
    }
    scores[key] = n;
  }

  const normalizedEmail = participant_email.toLowerCase().trim();
  const who5_total = (scores.who5_cheerful + scores.who5_calm + scores.who5_active + scores.who5_rested + scores.who5_interested) * 4;
  const cohort_year = new Date().getFullYear();

  const record = {
    client_id: client_id || null,
    service_id: service_id || null,
    participant_email: normalizedEmail,
    participant_phone: participant_phone || null,
    survey_type,
    ...scores,
    who5_total,
    cohort_year,
    submitted_at: new Date().toISOString(),
    assessment_phase,
  };

  // Use asServiceRole so unauthenticated (public) submits persist despite RLS read restrictions
  const created = await base44.asServiceRole.entities.CohortAssessment.create(record);

  return Response.json({ success: true, id: created.id, who5_total, cohort_year });
});