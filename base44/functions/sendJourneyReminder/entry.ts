import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://app.skillfulmeans.life').replace(/\/+$/, '');

async function sendSendGrid(to, subject, html) {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) { console.error('SENDGRID_API_KEY not set'); return false; }
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`SendGrid error (${response.status}): ${errorText}`);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { magic_key } = body;

    if (!magic_key) return Response.json({ error: 'missing_key' }, { status: 400 });

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter({ magic_key }, undefined, 1);
    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'invalid_key' }, { status: 404 });
    }
    const journey = journeys[0];

    // Organizer-only nudge — no employee emails
    const organizerEmail = (journey.email || '').toLowerCase().trim();
    if (!organizerEmail) {
      return Response.json({ error: 'no_organizer_email' }, { status: 400 });
    }

    // 48h rate limit
    const reminders = journey.reminder_sent_at || [];
    if (reminders.length > 0) {
      const lastReminder = new Date(reminders[reminders.length - 1]);
      const hoursSince = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 48) {
        const nextAvailable = new Date(lastReminder.getTime() + 48 * 60 * 60 * 1000);
        return Response.json({ error: 'rate_limited', next_available: nextAvailable.toISOString() }, { status: 429 });
      }
    }

    // Suppression check
    const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email: organizerEmail });
    if (suppressed && suppressed.length > 0) {
      return Response.json({ error: 'suppressed' }, { status: 400 });
    }

    // Count responses (unique _sid values)
    const allResponses = await base44.asServiceRole.entities.CohortAssessment.filter(
      { client_id: journey.client_id, survey_type: 'mfs' }, '-submitted_at', 4000
    );
    const sids = new Set();
    for (const r of allResponses) {
      const sid = r.instrument_subscores?._sid;
      if (sid) sids.add(sid);
    }
    const responseCount = sids.size;

    const surveyUrl = `${APP_BASE_URL}/MfsJourneySurvey?token=${journey.survey_token}`;
    const dashboardUrl = `${APP_BASE_URL}/FitnessRoi/dashboard?k=${journey.magic_key}`;
    const unsubLink = `${APP_BASE_URL}/Unsubscribe?email=${encodeURIComponent(organizerEmail)}`;
    const companyName = journey.company_name || 'your team';

    const subject = `Your Mental Fitness Journey — ${responseCount} response${responseCount !== 1 ? 's' : ''} so far`;
    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#0f766e;">${responseCount} ${responseCount === 1 ? 'person has' : 'people have'} taken your survey so far</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">Hi ${journey.contact_name || 'there'},</p>
<p style="color:#444;font-size:14px;line-height:1.6;">Your Mental Fitness Journey team survey is live for <strong>${companyName}</strong>. Right now <strong>${responseCount}</strong> ${responseCount === 1 ? 'person has' : 'people have'} responded.</p>
<p style="color:#444;font-size:14px;line-height:1.6;">For reliable results, re-send the survey link to everyone you shared it with — teams typically need at least 2 reminders to reach good participation.</p>
<a href="${surveyUrl}" style="display:inline-block;background:#0f766e;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">Survey link</a>
<a href="${dashboardUrl}" style="display:inline-block;background:#4a2040;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">View results</a>
<p style="color:#888;font-size:12px;margin-top:20px;"><a href="${unsubLink}" style="color:#888;">Unsubscribe</a></p>
</body></html>`;

    const now = new Date().toISOString();
    const sent = await sendSendGrid(organizerEmail, subject, html);
    if (sent) {
      await base44.asServiceRole.entities.EmailLog.create({
        from_email: 'admin@skillfulmeans.life',
        to_email: organizerEmail,
        subject,
        body_preview: `Mental Fitness Journey reminder — ${responseCount} responses. Survey: ${surveyUrl}`,
        date: now,
        direction: 'outbound',
        matched_client_id: journey.client_id,
        matched_lead_id: journey.lead_id,
      });
    }

    const updatedReminders = [...reminders, now];
    await base44.asServiceRole.entities.MfsJourney.update(journey.id, { reminder_sent_at: updatedReminders });

    return Response.json({ success: true, sent_count: sent ? 1 : 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});