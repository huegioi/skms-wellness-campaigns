import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Checks whether an attendee (by email) already has a CohortAssessment
// for this event's client + service + timing. Returns whether a survey
// is needed and which instruments to show (max 2 at check-in).

const INSTRUMENT_ITEM_COUNTS = {
  who5: 5, enps: 1, uwes3: 3, pss4: 4, ucla3: 3, cbi: 6,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, email } = body;
    if (!token || !email) {
      return Response.json({ error: 'Token and email are required' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Find event by token (exclude demo)
    const events = await base44.asServiceRole.entities.CalendarEvent.filter(
      { checkin_token: token, is_demo: false }
    );
    if (!events || events.length === 0) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = events[0];

    // No assessment needed if timing is none
    if (!event.assessment_timing || event.assessment_timing === 'none') {
      return Response.json({ needs_survey: false, reason: 'no_timing' });
    }

    // Fetch service for included_assessments + category
    let service = null;
    if (event.service_id) {
      const svcResults = await base44.asServiceRole.entities.Service.filter({ id: event.service_id });
      service = svcResults[0] || null;
    }
    const includedAssessments = service?.included_assessments || [];
    if (includedAssessments.length === 0) {
      return Response.json({ needs_survey: false, reason: 'no_instruments' });
    }

    // Determine survey_type from timing + service category
    const isChallenge = service?.category === 'challenge';
    const surveyType = event.assessment_timing === 'baseline'
      ? (isChallenge ? 'challenge_day0' : 'cohort_start')
      : (isChallenge ? 'challenge_day14' : 'cohort_end');

    // Dedup: check if this email already submitted for this client + service + survey_type
    const existing = await base44.asServiceRole.entities.CohortAssessment.filter({
      participant_email: normalizedEmail,
      survey_type: surveyType,
      client_id: event.client_id || null,
      service_id: event.service_id || null,
      is_demo: false,
    });

    if (existing && existing.length > 0) {
      return Response.json({ needs_survey: false, reason: 'already_submitted' });
    }

    // Select at most 2 instruments: who5 first, then first non-who5
    let instrumentsToShow = [];
    const skipped = [];
    if (includedAssessments.length <= 2) {
      instrumentsToShow = [...includedAssessments];
    } else {
      if (includedAssessments.includes('who5')) instrumentsToShow.push('who5');
      const firstNonWho5 = includedAssessments.find(i => i !== 'who5');
      if (firstNonWho5) instrumentsToShow.push(firstNonWho5);
      for (const inst of includedAssessments) {
        if (!instrumentsToShow.includes(inst)) skipped.push(inst);
      }
    }

    // Resolve meeting link
    const location = (event.location || '').trim();
    const isUrl = /^https?:\/\//i.test(location);
    const meetingLink = event.meeting_link || (isUrl ? location : null);

    return Response.json({
      needs_survey: true,
      timing: event.assessment_timing,
      survey_type: surveyType,
      instruments: instrumentsToShow,
      skipped_instruments: skipped,
      service_name: service?.name || event.title,
      service_id: event.service_id,
      client_id: event.client_id,
      meeting_link: meetingLink,
      total_questions: instrumentsToShow.reduce((s, k) => s + (INSTRUMENT_ITEM_COUNTS[k] || 0), 0),
    });
  } catch (error) {
    return Response.json({ error: error.message, needs_survey: false, reason: 'error' }, { status: 500 });
  }
});