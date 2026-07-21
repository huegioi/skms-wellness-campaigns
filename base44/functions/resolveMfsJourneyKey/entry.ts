import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { magic_key } = body;

    if (!magic_key) {
      return Response.json({ error: 'missing_key' }, { status: 400 });
    }

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter(
      { magic_key }, '-created_date', 1
    );

    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    const j = journeys[0];
    return Response.json({
      success: true,
      company_name: j.company_name,
      contact_name: j.contact_name,
      survey_token: j.survey_token,
      status: j.status,
      quick_scores: j.quick_scores,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});