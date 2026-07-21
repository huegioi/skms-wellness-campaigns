import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    // Get recipient list from EmailLog (original invite emails)
    const emailLogs = await base44.asServiceRole.entities.EmailLog.filter(
      { matched_client_id: journey.client_id, direction: 'outbound' }, '-date', 500
    );
    const inviteEmails = emailLogs
      .filter(log => log.subject && log.subject.startsWith('3 minutes, fully anonymous'))
      .map(log => log.to_email)
      .filter(Boolean);
    const uniqueRecipients = [...new Set(inviteEmails)];

    if (uniqueRecipients.length === 0) {
      return Response.json({ error: 'no_recipients' }, { status: 400 });
    }

    const appUrl = new URL(req.url).origin;
    const surveyUrl = `${appUrl}/MfsJourneySurvey?token=${journey.survey_token}`;
    const companyName = journey.company_name || 'your team';
    const subject = `Reminder: 3 minutes, fully anonymous — help shape wellbeing at ${companyName}`;
    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#0f766e;">A quick reminder — 3 minutes, fully anonymous</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">This is a friendly reminder from your leadership team to take the wellbeing check-in. It takes about 3 minutes, and your answers are <strong>fully anonymous</strong> — no name, no email, no account. Individual responses are never shown to your employer.</p>
<a href="${surveyUrl}" style="display:inline-block;background:#0f766e;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">Take the 3-minute survey</a>
<p style="color:#888;font-size:12px;margin-top:20px;">Your participation is voluntary. Questions? <a href="mailto:admin@skillfulmeans.life" style="color:#0f766e;">admin@skillfulmeans.life</a></p>
</body></html>`;

    const now = new Date().toISOString();
    let sentCount = 0;
    let suppressedCount = 0;

    for (const email of uniqueRecipients) {
      const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email });
      if (suppressed && suppressed.length > 0) { suppressedCount++; continue; }
      try {
        const sent = await sendSendGrid(email, subject, html);
        if (sent) {
          sentCount++;
          await base44.asServiceRole.entities.EmailLog.create({
            from_email: 'admin@skillfulmeans.life', to_email: email,
            subject, body_preview: `Reminder: anonymous team wellbeing survey. Survey link: ${surveyUrl}`,
            date: now, direction: 'outbound',
            matched_client_id: journey.client_id, matched_lead_id: journey.lead_id,
          });
        }
      } catch (e) { console.error(`Reminder failed for ${email}:`, e.message); }
    }

    // Append to reminder_sent_at
    const updatedReminders = [...reminders, now];
    await base44.asServiceRole.entities.MfsJourney.update(journey.id, { reminder_sent_at: updatedReminders });

    return Response.json({ success: true, sent_count: sentCount, suppressed_count: suppressedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});