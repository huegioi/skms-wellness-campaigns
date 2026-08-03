import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.skillfulmeans.life';
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = 'admin@skillfulmeans.life';
const FROM_NAME = 'SKMS Wellness';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // 1. Fetch all pending sends, filter for due + non-demo in code
    const allPending = await base44.asServiceRole.entities.ScheduledSurveySend.filter({ status: 'pending' }, 'send_at', 100);
    const dueSends = allPending.filter(s => !s.is_demo && new Date(s.send_at) <= now);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const send of dueSends) {
      try {
        const result = await processSend(base44, send);
        if (result.skipped) skipped++;
        else processed++;
      } catch (err) {
        errors++;
        // Mark as sent with error to prevent re-processing (status transition guard)
        await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
          status: 'sent',
          error_message: err.message,
          sent_at: new Date().toISOString()
        });
      }
    }

    // 2. Process cohort_end reminders (3 days after send, non-responders only, one reminder max)
    await processReminders(base44);

    return Response.json({ success: true, processed, skipped, errors, checked: dueSends.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processSend(base44, send) {
  // Journey organizer reminders — link-only flow, no employee emails
  if (send.send_type === 'journey_organizer_reminder') {
    return await processJourneyOrganizerReminder(base44, send);
  }

  // Check attendee_emails_allowed
  const clients = send.client_id ? await base44.asServiceRole.entities.Client.filter({ id: send.client_id }) : [];
  const client = clients[0];

  if (client && client.attendee_emails_allowed === false) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped',
      skip_reason: 'attendee_emails_allowed is off for this client',
      sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  // Compute recipients
  const recipients = await computeRecipients(base44, send);

  if (recipients.length === 0) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped',
      skip_reason: 'No eligible recipients (all submitted or suppressed)',
      sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  // Determine instrument set
  const instruments = await getInstruments(base44, send);

  // Create SurveyInvites + send emails
  let sentCount = 0;
  for (const email of recipients) {
    const token = crypto.randomUUID();
    await base44.asServiceRole.entities.SurveyInvite.create({
      token, email, client_id: send.client_id, service_id: send.service_id,
      survey_type: send.send_type, instruments,
      scheduled_send_id: send.id, created_at: new Date().toISOString()
    });
    try {
      await sendSurveyEmail(email, send.send_type, token);
      sentCount++;
    } catch (err) {
      // Continue with other recipients
    }
  }

  // Status transition: pending → sent (guard prevents double-fire)
  await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
    status: 'sent', recipient_count: sentCount, sent_at: new Date().toISOString()
  });
  return { skipped: false };
}

async function computeRecipients(base44, send) {
  let candidates = [];

  if (send.send_type === 'enps_post_session') {
    const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: send.event_id });
    candidates = checkins.filter(c => !c.is_demo).map(c => (c.email || '').toLowerCase().trim()).filter(Boolean);
  } else {
    // cohort_end / cohort_1mo: all distinct emails across engagement for client + service
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ client_id: send.client_id });
    const matchingEventIds = events.filter(e => !e.is_demo && e.service_id === send.service_id).map(e => e.id);

    for (const eid of matchingEventIds) {
      const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: eid });
      candidates.push(...checkins.filter(c => !c.is_demo).map(c => (c.email || '').toLowerCase().trim()).filter(Boolean));
    }

    const assessments = await base44.asServiceRole.entities.CohortAssessment.filter({ client_id: send.client_id });
    candidates.push(...assessments.filter(a => !a.is_demo && a.service_id === send.service_id)
      .map(a => (a.participant_email || '').toLowerCase().trim()).filter(Boolean));
  }

  candidates = [...new Set(candidates)];

  // Exclude suppressed
  const suppressions = await base44.asServiceRole.entities.EmailSuppression.list();
  const suppressedSet = new Set(suppressions.map(s => (s.email || '').toLowerCase().trim()));
  candidates = candidates.filter(e => !suppressedSet.has(e));

  // Exclude already-submitted for this timing
  const surveyTypeMap = { cohort_end: 'cohort_end', cohort_1mo: 'cohort_1mo', enps_post_session: 'enps_post_session' };
  const st = surveyTypeMap[send.send_type];
  if (st) {
    const submitted = await base44.asServiceRole.entities.CohortAssessment.filter({
      client_id: send.client_id, survey_type: st
    });
    const submittedSet = new Set(submitted.map(a => (a.participant_email || '').toLowerCase().trim()));
    candidates = candidates.filter(e => !submittedSet.has(e));
  }

  return candidates;
}

async function getInstruments(base44, send) {
  if (send.send_type === 'enps_post_session') return ['enps'];
  const services = send.service_id ? await base44.asServiceRole.entities.Service.filter({ id: send.service_id }) : [];
  const service = services[0];
  if (service?.included_assessments?.length) return service.included_assessments;
  return ['who5', 'enps'];
}

async function sendSurveyEmail(to, sendType, token) {
  const surveyLink = `${APP_URL}/CohortAssessment?t=${token}`;
  const unsubLink = `${APP_URL}/Unsubscribe?email=${encodeURIComponent(to)}`;

  const subjects = {
    enps_post_session: 'One question about today\u2019s session',
    cohort_end: 'How did your wellness program go?',
    cohort_1mo: 'How are things 30 days on?'
  };

  const intros = {
    enps_post_session: 'Thank you for attending today\u2019s session. We\u2019d love one quick piece of feedback.',
    cohort_end: 'Your wellness program has wrapped up. We\u2019d value your input on the experience.',
    cohort_1mo: 'It\u2019s been about a month since your wellness program. We\u2019d love to check in.'
  };

  const durations = {
    enps_post_session: 'It\u2019s one question and takes about 10 seconds.',
    cohort_end: 'It takes less than 2 minutes.',
    cohort_1mo: 'It takes less than 2 minutes.'
  };

  const buttons = {
    enps_post_session: 'Answer one question',
    cohort_end: 'Take the survey',
    cohort_1mo: 'Take the survey'
  };

  const body = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#013f7c,#264d44);padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">SKMS Wellness</h1>
    </div>
    <div style="background:#f9f9f9;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      <p style="color:#374151;font-size:15px;line-height:1.6">${intros[sendType]}</p>
      <p style="color:#374151;font-size:15px;line-height:1.6">${durations[sendType]}</p>
      <a href="${surveyLink}" style="display:inline-block;background:#264d44;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0">${buttons[sendType]}</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px"><a href="${unsubLink}" style="color:#9ca3af">Unsubscribe</a></p>
    </div>
  </div>`;

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: subjects[sendType],
      content: [{ type: 'text/html', value: body }]
    })
  });
  if (!resp.ok) throw new Error(`SendGrid ${resp.status}: ${await resp.text()}`);
}

async function processReminders(base44) {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const sentSends = await base44.asServiceRole.entities.ScheduledSurveySend.filter({
    send_type: 'cohort_end', status: 'sent', reminder_sent: false
  }, '-sent_at', 50);

  for (const send of sentSends) {
    if (send.is_demo) continue;
    if (!send.sent_at || new Date(send.sent_at) > threeDaysAgo) continue;

    // Find non-responders
    const invites = await base44.asServiceRole.entities.SurveyInvite.filter({ scheduled_send_id: send.id });
    const nonResponders = invites.filter(i => !i.submitted_at);

    for (const invite of nonResponders) {
      try {
        await sendReminderEmail(invite.email, invite.token);
      } catch (err) { /* continue */ }
    }

    // Mark reminder as sent
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, { reminder_sent: true });
  }
}

async function sendReminderEmail(to, token) {
  const surveyLink = `${APP_URL}/CohortAssessment?t=${token}`;
  const unsubLink = `${APP_URL}/Unsubscribe?email=${encodeURIComponent(to)}`;
  const body = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#013f7c,#264d44);padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">SKMS Wellness</h1>
    </div>
    <div style="background:#f9f9f9;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      <p style="color:#374151;font-size:15px;line-height:1.6">Just a friendly reminder \u2014 we\u2019d still love your feedback on your wellness program.</p>
      <a href="${surveyLink}" style="display:inline-block;background:#264d44;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0">Take the survey</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px"><a href="${unsubLink}" style="color:#9ca3af">Unsubscribe</a></p>
    </div>
  </div>`;

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: 'Reminder: How did your wellness program go?',
      content: [{ type: 'text/html', value: body }]
    })
  });
  if (!resp.ok) throw new Error(`SendGrid ${resp.status}`);
}

async function processJourneyOrganizerReminder(base44, send) {
  const journeys = send.journey_id
    ? await base44.asServiceRole.entities.MfsJourney.filter({ id: send.journey_id })
    : [];
  const journey = journeys[0];

  if (!journey) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped', skip_reason: 'Journey no longer exists', sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  if (journey.is_demo) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped', skip_reason: 'Demo journey', sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  const organizerEmail = (journey.email || '').toLowerCase().trim();
  if (!organizerEmail) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped', skip_reason: 'No organizer email on file', sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  // Suppression check
  const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email: organizerEmail });
  if (suppressed && suppressed.length > 0) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped', skip_reason: 'Organizer unsubscribed', sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  // Check if converted (is_assessment_lead turned false)
  if (journey.client_id) {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: journey.client_id });
    const client = clients[0];
    if (client && client.is_assessment_lead === false) {
      await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
        status: 'skipped', skip_reason: 'Lead converted to client', sent_at: new Date().toISOString()
      });
      return { skipped: true };
    }
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

  // Skip if responses >= 60% of team size
  const headcount = journey.headcount || 0;
  if (headcount > 0 && responseCount / headcount >= 0.6) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'skipped',
      skip_reason: `Strong participation (${responseCount}/${headcount} = ${Math.round(responseCount / headcount * 100)}%)`,
      sent_at: new Date().toISOString()
    });
    return { skipped: true };
  }

  // Send the organizer reminder email
  const surveyUrl = `${APP_URL}/MfsJourneySurvey?token=${journey.survey_token}`;
  const dashboardUrl = `${APP_URL}/FitnessRoi/dashboard?k=${journey.magic_key}`;
  const unsubLink = `${APP_URL}/Unsubscribe?email=${encodeURIComponent(organizerEmail)}`;
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

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: organizerEmail }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: html }]
      })
    });
    if (!resp.ok) throw new Error(`SendGrid ${resp.status}: ${await resp.text()}`);
  } catch (err) {
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
      status: 'sent', error_message: err.message, sent_at: new Date().toISOString()
    });
    return { skipped: false };
  }

  await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, {
    status: 'sent', recipient_count: 1, sent_at: new Date().toISOString()
  });

  return { skipped: false };
}