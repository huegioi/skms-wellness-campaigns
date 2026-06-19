import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const {
      service_id,
      service_name,
      client_id,
      company_name,
      behavior_intent,
      fit_confidence,
      advocacy_referral,
      nps_score,
      submitted_at,
    } = body;

    if (!behavior_intent || fit_confidence == null) {
      return Response.json({ error: 'behavior_intent and fit_confidence are required' }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities.FeedbackResponse.create({
      service_id: service_id || '',
      service_name: service_name || '',
      client_id: client_id || '',
      company_name: company_name || '',
      behavior_intent,
      fit_confidence,
      advocacy_referral: advocacy_referral || undefined,
      nps_score: nps_score != null ? nps_score : undefined,
      submitted_at: submitted_at || new Date().toISOString(),
    });

    return Response.json({ success: true, id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});