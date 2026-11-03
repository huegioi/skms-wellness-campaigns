import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { isChallengeBooking, challengeSignupUrl } from '../../shared/challengeInvite.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token } = body;
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const events = await base44.asServiceRole.entities.CalendarEvent.filter(
      { checkin_token: token, is_demo: false }
    );
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = events[0];

    // Resolve meeting link: explicit meeting_link, or location if it's a URL
    const location = (event.location || '').trim();
    const isUrl = /^https?:\/\//i.test(location);
    const meetingLink = event.meeting_link || (isUrl ? location : null);

    // Fetch company name for display ("Hosted for <company>")
    let clientCompany = null;
    if (event.client_id) {
      try {
        const client = await base44.asServiceRole.entities.Client.get(event.client_id);
        clientCompany = client?.company || client?.name || null;
      } catch { clientCompany = null; }
    } else if (event.lead_id) {
      try {
        const lead = await base44.asServiceRole.entities.Lead.get(event.lead_id);
        clientCompany = lead?.company || lead?.name || null;
      } catch { clientCompany = null; }
    }

    // Fetch service for assessment info
    let serviceInfo = null;
    if (event.service_id) {
      try {
        const svcResults = await base44.asServiceRole.entities.Service.filter({ id: event.service_id });
        const svc = svcResults[0] || null;
        if (svc) {
          serviceInfo = {
            id: svc.id,
            name: svc.name,
            category: svc.category,
            included_assessments: svc.included_assessments || [],
          };
        }
      } catch { serviceInfo = null; }
    }

    // A challenge has no session to check in to: the page sends people straight to
    // the challenge's sign-up link instead (src/pages/Checkin.jsx).
    const isChallenge = isChallengeBooking(event, serviceInfo);

    return Response.json({
      event_id: event.id,
      title: event.title,
      start_date: event.start_date,
      event_type: event.event_type || null,
      is_challenge: isChallenge,
      challenge_signup_url: isChallenge ? challengeSignupUrl(event) : null,
      client_company: clientCompany,
      has_meeting_link: !!meetingLink,
      meeting_link: meetingLink,
      client_id: event.client_id || null,
      service_id: event.service_id || null,
      assessment_timing: event.assessment_timing || 'none',
      service: serviceInfo,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});