import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

/**
 * Challenges-app invites (they carry challenge_program_id) follow the
 * service's CURRENT questionnaire list rather than the snapshot taken when the
 * invite was issued — so adding assessments to a service reaches people who
 * were already sent a link. And they only ask what the person hasn't answered
 * yet for this survey: someone who did the WHO-5 before more were added is
 * shown just the rest, and the invite only counts as done once every
 * questionnaire is in. (Changed 10 Oct 2026.)
 */
function challengeInstruments(service: { included_assessments?: string[] } | undefined, surveyType: string): string[] {
  const all = service?.included_assessments?.length ? service.included_assessments : ['who5'];
  if (surveyType !== 'challenge_day0') return all;
  // eNPS asks whether they'd recommend the programme — nothing to say yet.
  const baseline = all.filter((k) => k !== 'enps');
  return baseline.length ? baseline : ['who5'];
}

/** Questionnaires this person has already answered for this invite. */
async function answeredFor(base44: any, invite: any): Promise<Set<string>> {
  const rows = await base44.asServiceRole.entities.CohortAssessment.filter({
    participant_email: String(invite.email || '').toLowerCase().trim(),
    survey_type: invite.survey_type,
    service_id: invite.service_id,
  });
  // Only answers given since this invite was issued count — a score from an
  // earlier run of the same programme isn't this run's starting point.
  const since = invite.created_at ? new Date(invite.created_at).getTime() - 60_000 : 0;
  const done = new Set<string>();
  for (const r of rows) {
    const at = new Date(r.submitted_at || r.created_date || 0).getTime();
    if (r.instrument && at >= since) done.add(r.instrument);
  }
  return done;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, mark_submitted } = await req.json();
    if (!token) return Response.json({ error: 'token required' }, { status: 400 });

    const invites = await base44.asServiceRole.entities.SurveyInvite.filter({ token });
    const invite = invites[0];
    if (!invite) return Response.json({ error: 'Invalid or expired token' }, { status: 404 });

    let service: any = undefined;
    if (invite.service_id) {
      const services = await base44.asServiceRole.entities.Service.filter({ id: invite.service_id });
      service = services[0];
    }
    const serviceName = service?.name || '';

    const isChallenge = !!invite.challenge_program_id;
    let instruments: string[] = invite.instruments || [];
    let answered: string[] = [];
    if (isChallenge) {
      const current = challengeInstruments(service, invite.survey_type);
      const done = await answeredFor(base44, invite);
      answered = current.filter((k) => done.has(k));
      instruments = current.filter((k) => !done.has(k));
      // Keep the stored list in step with the service, for the record.
      if (JSON.stringify(invite.instruments || []) !== JSON.stringify(current)) {
        await base44.asServiceRole.entities.SurveyInvite.update(invite.id, { instruments: current });
      }
    }

    // Mark as submitted when the respondent completes the survey. A challenge
    // invite only counts once every questionnaire is in.
    if (mark_submitted) {
      if (!invite.submitted_at && (!isChallenge || instruments.length === 0)) {
        await base44.asServiceRole.entities.SurveyInvite.update(invite.id, {
          submitted_at: new Date().toISOString()
        });
        return Response.json({ success: true, marked_submitted: true });
      }
      return Response.json({ success: true, marked_submitted: false, remaining: instruments.length });
    }

    return Response.json({
      success: true,
      email: invite.email,
      client_id: invite.client_id,
      service_id: invite.service_id,
      survey_type: invite.survey_type,
      instruments,
      answered_instruments: answered,
      service_name: serviceName,
      event_id: invite.event_id || null,
      // Challenge invites: done when nothing is left to answer, even if the
      // invite was marked submitted before more questionnaires were added.
      already_submitted: isChallenge ? instruments.length === 0 : !!invite.submitted_at
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
