import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token, who5, pss4, uwes3, ucla3 } = body;

    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

    const assessments = await base44.asServiceRole.entities.MfsAssessment.filter({ token }, undefined, 1);
    if (!assessments || assessments.length === 0) {
      return Response.json({ error: 'Invalid assessment token' }, { status: 404 });
    }
    const assessment = assessments[0];
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    // One anonymous ID per submission — shared across all instruments so response
    // count = distinct participants, not distinct records.
    // Stored in instrument_subscores._sid (NOT participant_email — that stays empty for anonymity).
    const submissionId = `mfs-${crypto.randomUUID()}`;

    const instruments = [
      { key: 'who5',  responses: who5 },
      { key: 'pss4',  responses: pss4 },
      { key: 'uwes3', responses: uwes3 },
      { key: 'ucla3', responses: ucla3 },
    ];

    for (const inst of instruments) {
      if (!inst.responses) continue;
      const raw = Object.values(inst.responses).reduce((s, v) => s + (v || 0), 0);
      const record = {
        client_id: assessment.client_id,
        survey_type: 'mfs',
        instrument: inst.key,
        participant_email: '',
        instrument_subscores: { _sid: submissionId },
        instrument_total: raw,
        item_responses: inst.responses,
        cohort_year: year,
        submitted_at: now,
      };
      if (inst.key === 'who5') {
        record.who5_cheerful = inst.responses.q1;
        record.who5_calm = inst.responses.q2;
        record.who5_active = inst.responses.q3;
        record.who5_rested = inst.responses.q4;
        record.who5_interested = inst.responses.q5;
        record.who5_total = raw * 4;
      }
      await base44.asServiceRole.entities.CohortAssessment.create(record);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});