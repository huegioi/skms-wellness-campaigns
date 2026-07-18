import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token } = body;

    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

    const assessments = await base44.asServiceRole.entities.MfsAssessment.filter({ token }, undefined, 1);
    if (!assessments || assessments.length === 0) {
      return Response.json({ error: 'Invalid token' }, { status: 404 });
    }
    const assessment = assessments[0];

    const cohortAssessments = await base44.asServiceRole.entities.CohortAssessment.filter(
      { client_id: assessment.client_id, survey_type: 'mfs' },
      '-submitted_at',
      500
    );

    // Group by submission ID (stored in instrument_subscores._sid)
    const bySubmission = {};
    for (const row of cohortAssessments) {
      const sid = row.instrument_subscores?._sid || '';
      if (!sid) continue;
      if (!bySubmission[sid]) bySubmission[sid] = {};
      bySubmission[sid][row.instrument] = row;
    }

    const responseCount = Object.keys(bySubmission).length;
    const MIN_RESPONSES = 5;

    // Per-instrument averages (normalized 0–100)
    const instrumentAverages = {};
    const instrumentCounts = {};
    for (const key of ['who5', 'pss4', 'uwes3', 'ucla3']) {
      const scores = [];
      for (const sid of Object.keys(bySubmission)) {
        const row = bySubmission[sid][key];
        if (!row) continue;
        const norm = normalizeInstrument(key, row.item_responses);
        if (norm != null) scores.push(norm);
      }
      instrumentAverages[key] = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
      instrumentCounts[key] = scores.length;
    }

    // Composite = mean of per-respondent composites
    const perRespondentComposites = [];
    for (const sid of Object.keys(bySubmission)) {
      const respondentScores = [];
      for (const key of ['who5', 'pss4', 'uwes3', 'ucla3']) {
        const row = bySubmission[sid][key];
        if (!row) continue;
        const norm = normalizeInstrument(key, row.item_responses);
        if (norm != null) respondentScores.push(norm);
      }
      if (respondentScores.length > 0) {
        perRespondentComposites.push(respondentScores.reduce((a, b) => a + b, 0) / respondentScores.length);
      }
    }
    const composite = perRespondentComposites.length > 0
      ? perRespondentComposites.reduce((a, b) => a + b, 0) / perRespondentComposites.length
      : null;

    // 5-response privacy gate
    const locked = responseCount < MIN_RESPONSES;

    return Response.json({
      assessment: {
        company_name: assessment.company_name,
        contact_name: assessment.contact_name,
        employee_count: assessment.employee_count,
        industry: assessment.industry,
        goals: assessment.goals || [],
        status: assessment.status,
        created_date: assessment.created_date,
        token: assessment.token,
      },
      response_count: responseCount,
      min_responses: MIN_RESPONSES,
      locked,
      composite: locked ? null : composite,
      instruments: locked ? null : {
        who5:  { average: instrumentAverages.who5,  count: instrumentCounts.who5 },
        pss4:  { average: instrumentAverages.pss4,  count: instrumentCounts.pss4 },
        uwes3: { average: instrumentAverages.uwes3, count: instrumentCounts.uwes3 },
        ucla3: { average: instrumentAverages.ucla3, count: instrumentCounts.ucla3 },
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizeInstrument(instrumentKey, responses) {
  if (!responses) return null;
  const q1 = responses.q1 || 0;
  const q2 = responses.q2 || 0;
  const q3 = responses.q3 || 0;
  const q4 = responses.q4 || 0;
  const q5 = responses.q5 || 0;
  switch (instrumentKey) {
    case 'who5':
      return (q1 + q2 + q3 + q4 + q5) * 4;
    case 'pss4':
      return ((16 - (q1 + q2 + q3 + q4)) / 16) * 100;
    case 'uwes3':
      return (((q1 + q2 + q3) / 3) / 6) * 100;
    case 'ucla3':
      return ((9 - (q1 + q2 + q3)) / 6) * 100;
    default:
      return null;
  }
}