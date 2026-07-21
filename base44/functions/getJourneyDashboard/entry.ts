import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { magic_key } = body;

    if (!magic_key) return Response.json({ error: 'missing_key' }, { status: 400 });

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter({ magic_key }, undefined, 1);
    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    const j = journeys[0];

    // Count distinct participants
    const allResponses = await base44.asServiceRole.entities.CohortAssessment.filter(
      { client_id: j.client_id, survey_type: 'mfs' }, '-submitted_at', 500
    );
    const sids = new Set();
    for (const r of allResponses) {
      const sid = r.instrument_subscores?._sid;
      if (sid) sids.add(sid);
    }

    return Response.json({
      success: true,
      company_name: j.company_name,
      contact_name: j.contact_name,
      survey_token: j.survey_token,
      status: j.status,
      quick_scores: j.quick_scores,
      roi_snapshot: j.roi_snapshot,
      response_count: sids.size,
      reminder_sent_at: j.reminder_sent_at || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});