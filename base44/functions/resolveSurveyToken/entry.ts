import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, mark_submitted } = await req.json();
    if (!token) return Response.json({ error: 'token required' }, { status: 400 });

    const invites = await base44.asServiceRole.entities.SurveyInvite.filter({ token });
    const invite = invites[0];
    if (!invite) return Response.json({ error: 'Invalid or expired token' }, { status: 404 });

    // Mark as submitted when the respondent completes the survey
    if (mark_submitted && !invite.submitted_at) {
      await base44.asServiceRole.entities.SurveyInvite.update(invite.id, {
        submitted_at: new Date().toISOString()
      });
      return Response.json({ success: true, marked_submitted: true });
    }

    // Fetch service name for display
    let serviceName = '';
    if (invite.service_id) {
      const services = await base44.asServiceRole.entities.Service.filter({ id: invite.service_id });
      serviceName = services[0]?.name || '';
    }

    return Response.json({
      success: true,
      email: invite.email,
      client_id: invite.client_id,
      service_id: invite.service_id,
      survey_type: invite.survey_type,
      instruments: invite.instruments || [],
      service_name: serviceName,
      already_submitted: !!invite.submitted_at
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});