import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { clientIsDemoOrInternal } from '../../shared/demoClient.ts';

// Creates CohortAssessment rows from a check-in survey submission.
// CRITICAL: Fails open — always returns the meeting_link so the attendee
// is never blocked from joining the call by a survey error.

const INSTRUMENT_DEFS = {
  who5: {
    items: ['q1', 'q2', 'q3', 'q4', 'q5'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 5,
    score: (r) => (r.q1 + r.q2 + r.q3 + r.q4 + r.q5) * 4,
  },
  enps: {
    items: ['q1'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 10,
    score: (r) => r.q1,
  },
  uwes3: {
    items: ['q1', 'q2', 'q3'],
    validate: (v) => typeof v === 'number' && v >= 0 && v <= 6,
    score: (r) => Math.round(((r.q1 + r.q2 + r.q3) / 3) * 100) / 100,
  },
  pss4: {
    items: ['q1', 'q2', 'q3', 'q4'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 4,
    score: (r) => r.q1 + (4 - r.q2) + (4 - r.q3) + r.q4,
  },
  ucla3: {
    items: ['q1', 'q2', 'q3'],
    validate: (v) => Number.isInteger(v) && v >= 1 && v <= 3,
    score: (r) => r.q1 + r.q2 + r.q3,
  },
  cbi: {
    items: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    validate: (v) => Number.isInteger(v) && v >= 0 && v <= 4,
    score: (r) => {
      const vals = [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6];
      const rescaled = vals.map(v => v * 25);
      return Math.round(rescaled.reduce((a, b) => a + b, 0) / rescaled.length * 100) / 100;
    },
  },
};

Deno.serve(async (req) => {
  let meetingLink = null;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, email, name, answers } = body;

    // Resolve meeting link from event (fail-open: even if everything else fails)
    const events = await base44.asServiceRole.entities.CalendarEvent.filter(
      { checkin_token: token, is_demo: false }
    );
    if (events && events.length > 0) {
      const event = events[0];
      const location = (event.location || '').trim();
      const isUrl = /^https?:\/\//i.test(location);
      meetingLink = event.meeting_link || (isUrl ? location : null);
    }

    if (!token || !email) {
      return Response.json({ success: false, error: 'Token and email are required', meeting_link: meetingLink }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!events || events.length === 0) {
      return Response.json({ success: false, error: 'Event not found', meeting_link: meetingLink }, { status: 404 });
    }
    const event = events[0];

    // No-op if timing is none
    if (!event.assessment_timing || event.assessment_timing === 'none') {
      return Response.json({ success: true, meeting_link: meetingLink, reason: 'no_timing' });
    }

    // Fetch service for category
    let service = null;
    if (event.service_id) {
      const svcResults = await base44.asServiceRole.entities.Service.filter({ id: event.service_id });
      service = svcResults[0] || null;
    }
    const timing = event.assessment_timing;
    const isChallenge = service?.category === 'challenge';

    // Effective instruments per timing (mirrors checkCheckinAssessment):
    //   baseline → BASELINE_BATTERY (eNPS excluded, service.included_assessments ignored)
    //   session / endpoint → service.included_assessments minus 'enps'
    const BASELINE_BATTERY = ['who5', 'uwes3', 'pss4', 'ucla3', 'cbi'];
    const effectiveAssessments = timing === 'baseline'
      ? BASELINE_BATTERY
      : (service?.included_assessments || []).filter(a => a !== 'enps');
    if (effectiveAssessments.length === 0 || !answers || typeof answers !== 'object') {
      return Response.json({ success: true, meeting_link: meetingLink, reason: 'no_instruments' });
    }

    // survey_type mapping:
    //   baseline  → challenge_day0 / cohort_start
    //   endpoint  → challenge_day14 / cohort_end
    //   session   → 'session_check' (honest mid-program stamp, distinct from endpoint)
    const surveyType = timing === 'baseline'
      ? (isChallenge ? 'challenge_day0' : 'cohort_start')
      : timing === 'endpoint'
        ? (isChallenge ? 'challenge_day14' : 'cohort_end')
        : 'session_check';

    // Stamp is_demo when the owning client is demo or internal, so test survey
    // runs never pollute admin analytics.
    const stampIsDemo = await clientIsDemoOrInternal(base44, event.client_id);

    // cohort_year from the EVENT's start_date (not submission time) so a late
    // submission doesn't land in the wrong plan year.
    const cohort_year = event.start_date ? new Date(event.start_date).getFullYear() : new Date().getFullYear();

    // Dedup (mirrors checkCheckinAssessment):
    //   baseline → survey_type + cohort_year (one per person per client per plan year)
    //   session / endpoint → event_id (one per person per event)
    let dedupFilter;
    if (timing === 'baseline') {
      dedupFilter = {
        participant_email: normalizedEmail,
        client_id: event.client_id || null,
        survey_type: surveyType,
        cohort_year,
        is_demo: stampIsDemo,
      };
    } else {
      dedupFilter = {
        participant_email: normalizedEmail,
        event_id: event.id || null,
        is_demo: stampIsDemo,
      };
    }
    const existing = await base44.asServiceRole.entities.CohortAssessment.filter(dedupFilter);
    if (existing && existing.length > 0) {
      return Response.json({ success: true, meeting_link: meetingLink, reason: 'already_submitted' });
    }

    // Create a CohortAssessment row for each instrument in answers
    const submitted_at = new Date().toISOString();
    const createdIds = [];

    for (const instKey of Object.keys(answers)) {
      const def = INSTRUMENT_DEFS[instKey];
      if (!def) continue;

      const itemResponses = answers[instKey];
      // Validate all items present
      let valid = true;
      for (const qKey of def.items) {
        const raw = itemResponses[qKey];
        if (raw === undefined || raw === null) { valid = false; break; }
        const v = typeof raw === 'string' ? Number(raw) : raw;
        if (!def.validate(v)) { valid = false; break; }
        itemResponses[qKey] = v;
      }
      if (!valid) continue; // skip invalid instrument, don't fail the whole submission

      const instrument_total = def.score(itemResponses);

      // Build record
      const record = {
        client_id: event.client_id || null,
        service_id: event.service_id || null,
        event_id: event.id || null,
        participant_email: normalizedEmail,
        survey_type: surveyType,
        instrument: instKey,
        instrument_total,
        item_responses: itemResponses,
        cohort_year,
        submitted_at,
        assessment_phase: 'Phase 2',
        is_demo: stampIsDemo,
      };

      // Populate legacy WHO-5 columns for back-compat
      if (instKey === 'who5') {
        record.who5_cheerful = itemResponses.q1;
        record.who5_calm = itemResponses.q2;
        record.who5_active = itemResponses.q3;
        record.who5_rested = itemResponses.q4;
        record.who5_interested = itemResponses.q5;
        record.who5_total = instrument_total;
      }

      try {
        const created = await base44.asServiceRole.entities.CohortAssessment.create(record);
        createdIds.push(created.id);
      } catch (e) {
        // Log but continue — fail open
        console.error(`Failed to create ${instKey} assessment:`, e.message);
      }
    }

    return Response.json({
      success: true,
      meeting_link: meetingLink,
      created_count: createdIds.length,
      survey_type: surveyType,
    });
  } catch (error) {
    // FAIL OPEN: always return the meeting link
    return Response.json({
      success: false,
      error: error.message,
      meeting_link: meetingLink,
    }, { status: 500 });
  }
});