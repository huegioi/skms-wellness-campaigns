import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Checks whether an attendee (by email) already has a CohortAssessment
// for this event's client + service + timing. Returns whether a survey
// is needed and which instruments to show.

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
    const timing = event.assessment_timing;
    if (!timing || timing === 'none') {
      return Response.json({ needs_survey: false, reason: 'no_timing' });
    }

    // Fetch service for included_assessments + category
    let service = null;
    if (event.service_id) {
      const svcResults = await base44.asServiceRole.entities.Service.filter({ id: event.service_id });
      service = svcResults[0] || null;
    }
    const isChallenge = service?.category === 'challenge';

    // Instruments per timing.
    // baseline → BASELINE_BATTERY (hardcoded — backend can't import from src/).
    //   eNPS is deliberately excluded; it is always collected post-session.
    //   Service.included_assessments is IGNORED for baseline.
    // session / endpoint → service.included_assessments minus 'enps'. If empty, no survey.
    let instrumentsToShow;
    let skipped;
    if (timing === 'baseline') {
      instrumentsToShow = ['who5', 'uwes3', 'pss4', 'ucla3', 'cbi'];
      skipped = [];
    } else {
      const all = service?.included_assessments || [];
      instrumentsToShow = all.filter(a => a !== 'enps');
      skipped = all.filter(a => a === 'enps');
      if (instrumentsToShow.length === 0) {
        return Response.json({ needs_survey: false, reason: 'no_instruments' });
      }
    }

    // survey_type mapping:
    //   baseline  → challenge_day0 / cohort_start
    //   endpoint  → challenge_day14 / cohort_end
    //   session   → challenge_day14 / cohort_end (reuses endpoint enums — no new value needed)
    const surveyType = timing === 'baseline'
      ? (isChallenge ? 'challenge_day0' : 'cohort_start')
      : (isChallenge ? 'challenge_day14' : 'cohort_end');

    // cohort_year from the event's start_date year (plan-year aware dedup)
    const cohort_year = event.start_date ? new Date(event.start_date).getFullYear() : new Date().getFullYear();

    // Dedup:
    //   baseline → one per person per client per plan year (survey_type + cohort_year)
    //   session / endpoint → one per person per event (event_id), so each session collects its own row
    let dedupFilter;
    if (timing === 'baseline') {
      dedupFilter = {
        participant_email: normalizedEmail,
        client_id: event.client_id || null,
        survey_type: surveyType,
        cohort_year,
        is_demo: false,
      };
    } else {
      dedupFilter = {
        participant_email: normalizedEmail,
        event_id: event.id || null,
        is_demo: false,
      };
    }
    const existing = await base44.asServiceRole.entities.CohortAssessment.filter(dedupFilter);

    if (existing && existing.length > 0) {
      return Response.json({ needs_survey: false, reason: 'already_submitted' });
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