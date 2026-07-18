import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token, who5, pss4 } = body;

    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

    const assessments = await base44.asServiceRole.entities.MfsAssessment.filter({ token }, undefined, 1);
    if (!assessments || assessments.length === 0) {
      return Response.json({ error: 'Invalid assessment token' }, { status: 404 });
    }
    const assessment = assessments[0];
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    // One anonymous ID per submission — shared across WHO-5 + PSS-4 so response
    // count = distinct participants, not distinct records.
    const submissionId = `mfs-${crypto.randomUUID()}`;

    // ── Create WHO-5 CohortAssessment ──
    if (who5) {
      const sum = (who5.q1 || 0) + (who5.q2 || 0) + (who5.q3 || 0) + (who5.q4 || 0) + (who5.q5 || 0);
      const who5Total = sum * 4; // 0–100
      await base44.asServiceRole.entities.CohortAssessment.create({
        client_id: assessment.client_id,
        survey_type: 'mfs',
        instrument: 'who5',
        participant_email: submissionId,
        instrument_total: who5Total,
        item_responses: who5,
        who5_cheerful: who5.q1,
        who5_calm: who5.q2,
        who5_active: who5.q3,
        who5_rested: who5.q4,
        who5_interested: who5.q5,
        who5_total: who5Total,
        cohort_year: year,
        submitted_at: now,
      });
    }

    // ── Create PSS-4 CohortAssessment ──
    if (pss4) {
      const pss4Total = (pss4.q1 || 0) + (pss4.q2 || 0) + (pss4.q3 || 0) + (pss4.q4 || 0);
      await base44.asServiceRole.entities.CohortAssessment.create({
        client_id: assessment.client_id,
        survey_type: 'mfs',
        instrument: 'pss4',
        participant_email: submissionId,
        instrument_total: pss4Total,
        item_responses: pss4,
        cohort_year: year,
        submitted_at: now,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});