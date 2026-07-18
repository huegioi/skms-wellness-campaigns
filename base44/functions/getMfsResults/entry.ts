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

    const who5Rows = cohortAssessments.filter(a => a.instrument === 'who5' && a.who5_total != null);
    const pss4Rows = cohortAssessments.filter(a => a.instrument === 'pss4' && a.instrument_total != null);

    const who5Avg = who5Rows.length > 0
      ? Math.round(who5Rows.reduce((s, a) => s + a.who5_total, 0) / who5Rows.length)
      : null;
    const pss4Avg = pss4Rows.length > 0
      ? Math.round((pss4Rows.reduce((s, a) => s + a.instrument_total, 0) / pss4Rows.length) * 10) / 10
      : null;

    // Distinct respondents (by submissionId shared across WHO-5 + PSS-4)
    const respondentEmails = new Set(cohortAssessments.map(a => a.participant_email));
    const responseCount = respondentEmails.size;

    return Response.json({
      assessment: {
        company_name: assessment.company_name,
        contact_name: assessment.contact_name,
        employee_count: assessment.employee_count,
        industry: assessment.industry,
        goals: assessment.goals || [],
        status: assessment.status,
        created_date: assessment.created_date,
      },
      response_count: responseCount,
      who5: {
        average: who5Avg,
        count: who5Rows.length,
        scores: who5Rows.map(r => r.who5_total),
      },
      pss4: {
        average: pss4Avg,
        count: pss4Rows.length,
        scores: pss4Rows.map(r => r.instrument_total),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});