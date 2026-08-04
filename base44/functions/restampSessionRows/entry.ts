import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// One-off: restamps mid-program "session" check-in rows that were incorrectly
// stamped with the endpoint survey_type (cohort_end / challenge_day14) back to
// 'session_check'. A row is restamped only when its CalendarEvent's
// assessment_timing === 'session'. Skips is_demo rows.
// Not run automatically — invoke once from the admin UI.

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Load endpoint-stamped rows (skip demo). event_id filtering happens in-loop
    // since the filter API doesn't support exists-style queries.
    const cohortEndRows = await base44.asServiceRole.entities.CohortAssessment.filter(
      { survey_type: 'cohort_end', is_demo: false }, '-submitted_at', 2000
    );
    const challengeDay14Rows = await base44.asServiceRole.entities.CohortAssessment.filter(
      { survey_type: 'challenge_day14', is_demo: false }, '-submitted_at', 2000
    );
    const rows = [...cohortEndRows, ...challengeDay14Rows];

    let scanned = 0;
    let changed = 0;
    const details = [];

    // Cache events so multiple instrument rows for the same session aren't re-fetched
    const eventCache = new Map();

    for (const row of rows) {
      scanned++;
      if (!row.event_id) continue;

      let event = eventCache.get(row.event_id);
      if (!event) {
        const evs = await base44.asServiceRole.entities.CalendarEvent.filter({ id: row.event_id });
        event = evs[0] || null;
        if (event) eventCache.set(row.event_id, event);
      }

      if (event && event.assessment_timing === 'session') {
        await base44.asServiceRole.entities.CohortAssessment.update(row.id, { survey_type: 'session_check' });
        changed++;
        details.push({ id: row.id, event_id: row.event_id, from: row.survey_type, to: 'session_check' });
      }
    }

    return Response.json({ success: true, scanned, changed, details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});