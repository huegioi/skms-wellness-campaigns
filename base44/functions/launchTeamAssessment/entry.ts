import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

async function sendMailgun(apiKey, domain, to, subject, html) {
  const formData = new FormData();
  formData.append('from', `SkillfulMeans Wellness <mailgun@${domain}>`);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);
  let response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST', headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` }, body: formData
  });
  if (response.status === 401 || response.status === 404) {
    response = await fetch(`https://api.eu.mailgun.net/v3/${domain}/messages`, {
      method: 'POST', headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` }, body: formData
    });
  }
  return response.ok;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { magic_key, employee_emails } = body;

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
    const appUrl = new URL(req.url).origin;
    const surveyUrl = `${appUrl}/MfsJourneySurvey?token=${journey.survey_token}`;
    const companyName = journey.company_name || 'your team';

    // Parse, validate, dedupe emails
    const rawEmails = String(employee_emails || '')
      .split(/[\s,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const uniqueEmails = [...new Set(rawEmails)].slice(0, 500);

    // Copy-link mode: no emails, just set status (only if still quick_done)
    if (uniqueEmails.length === 0) {
      if (journey.status === 'quick_done') {
        await base44.asServiceRole.entities.MfsJourney.update(journey.id, { status: 'team_launched' });
      }
      return Response.json({ success: true, mode: 'copy_link', survey_url: surveyUrl });
    }

    const subject = `3 minutes, fully anonymous — help shape wellbeing at ${companyName}`;
    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#0f766e;">3 minutes. Fully anonymous.</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">Your leadership team is running a free team wellbeing check-in through SkillfulMeans. This is your invitation to take part.</p>
<p style="color:#444;font-size:14px;line-height:1.6;">It takes about 3 minutes. Your answers are <strong>fully anonymous</strong> — no name, no email, no account. Individual responses are never shown to your employer. Only team-level aggregates are shared.</p>
<a href="${surveyUrl}" style="display:inline-block;background:#0f766e;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">Take the 3-minute survey</a>
<p style="color:#888;font-size:12px;margin-top:20px;">Your participation is voluntary. Questions? <a href="mailto:admin@skillfulmeans.life" style="color:#0f766e;">admin@skillfulmeans.life</a></p>
</body></html>`;

    const mailgunKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');
    const now = new Date().toISOString();
    let sentCount = 0;
    let suppressedCount = 0;

    if (mailgunKey && mailgunDomain) {
      for (const email of uniqueEmails) {
        const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email });
        if (suppressed && suppressed.length > 0) {
          suppressedCount++;
          continue;
        }
        try {
          await sendMailgun(mailgunKey, mailgunDomain, email, subject, html);
          sentCount++;
          await base44.asServiceRole.entities.EmailLog.create({
            from_email: `mailgun@${mailgunDomain}`,
            to_email: email,
            subject,
            body_preview: `Anonymous team wellbeing survey invite. Survey link: ${surveyUrl}`,
            date: now,
            direction: 'outbound',
            matched_client_id: journey.client_id,
            matched_lead_id: journey.lead_id,
          });
        } catch (e) {
          console.error(`Failed to send to ${email}:`, e.message);
        }
      }
    }

    if (journey.status === 'quick_done') {
      await base44.asServiceRole.entities.MfsJourney.update(journey.id, { status: 'team_launched' });
    }

    return Response.json({
      success: true,
      mode: 'email',
      sent_count: sentCount,
      suppressed_count: suppressedCount,
      total_emails: uniqueEmails.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});