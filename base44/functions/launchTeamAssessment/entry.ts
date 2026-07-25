import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://app.skillfulmeans.life').replace(/\/+$/, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { magic_key } = body;

    if (!magic_key) {
      return Response.json({ error: 'missing_key' }, { status: 400 });
    }

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter(
      { magic_key }, '-created_date', 1
    );
    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'invalid_key' }, { status: 404 });
    }

    const journey = journeys[0];
    const surveyUrl = `${APP_BASE_URL}/MfsJourneySurvey?token=${journey.survey_token}`;

    // Set status to team_launched (only if still quick_done)
    if (journey.status === 'quick_done') {
      await base44.asServiceRole.entities.MfsJourney.update(journey.id, { status: 'team_launched' });
    }

    // Queue two organizer reminders (day 3 + day 7) — only for non-demo journeys
    if (!journey.is_demo) {
      const now = Date.now();
      const day3 = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
      const day7 = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

      for (const sendAt of [day3, day7]) {
        await base44.asServiceRole.entities.ScheduledSurveySend.create({
          send_type: 'journey_organizer_reminder',
          journey_id: journey.id,
          client_id: journey.client_id || undefined,
          send_at: sendAt,
          status: 'pending',
          is_demo: false,
        });
      }
    }

    return Response.json({ success: true, mode: 'copy_link', survey_url: surveyUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});