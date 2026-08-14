import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const APP_URL = Deno.env.get('APP_URL') || 'https://app.skillfulmeans.life';
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = 'admin@skillfulmeans.life';
const FROM_NAME = 'SkillfulMeans';

// Session times are rendered in this zone rather than the server's (UTC).
// Without it a noon-Eastern workshop prints as "4:00 PM" in the email, because
// the function runs in UTC and toLocaleString defaults to the host zone.
const DISPLAY_TZ = 'America/New_York';

// Matches the check-in page's fmtDate exactly, so the date a person sees in the
// email is the one they saw when they checked in.
function formatSessionWhen(startDate) {
  if (!startDate) return '';
  const dt = new Date(startDate);
  if (isNaN(dt.getTime())) return '';
  const day = dt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: DISPLAY_TZ,
  });
  const time = dt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: DISPLAY_TZ,
  });
  return `${day} at ${time}`;
}

// First name for the greeting. Returns null when there is nothing usable, so the
// caller falls back to "Hey there," — check-in records sometimes carry an email
// address in the name field, and "Hey heather@skillfulmeans.life," reads broken.
function firstNameFrom(raw) {
  const s = (raw || '').trim();
  if (!s || s.includes('@')) return null;
  const first = s.split(/\s+/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Event title / time / client company for the session block. Best-effort: any
// piece that is missing is simply omitted rather than printed blank.
async function buildSessionContext(base44, send) {
  const ctx = { title: '', when: '', company: '' };
  if (send.event_id) {
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: send.event_id });
    const ev = events[0];
    if (ev) {
      ctx.title = ev.title || '';
      ctx.when = formatSessionWhen(ev.start_date);
    }
  }
  if (send.client_id) {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: send.client_id });
    ctx.company = clients[0]?.company || '';
  }
  return ctx;
}

function sessionBlockHtml(ctx) {
  if (!ctx || (!ctx.title && !ctx.when && !ctx.company)) return '';
  const rows = [];
  if (ctx.title) rows.push(`<p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#013f7c;line-height:1.35">${escapeHtml(ctx.title)}</p>`);
  if (ctx.when) rows.push(`<p style="margin:0;font-size:13px;color:#6b7280">${escapeHtml(ctx.when)}</p>`);
  if (ctx.company) rows.push(`<p style="margin:3px 0 0;font-size:13px;color:#9ca3af">Hosted for ${escapeHtml(ctx.company)}</p>`);
  return `<div style="border-left:3px solid #013f7c;padding:2px 0 2px 14px;margin:0 0 18px">${rows.join('')}</div>`;
}

function greetingHtml(name) {
  const who = name ? `${escapeHtml(name)}` : 'there';
  return `<p style="margin:0 0 16px;color:#374151;font-size:15px">Hey ${who},</p>`;
}

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

  // Session name / date / company shown in the email, matching the check-in page.
  const sessionCtx = await buildSessionContext(base44, send);

  // Create SurveyInvites + send emails
  let sentCount = 0;
  for (const { email, name } of recipients) {
    const token = crypto.randomUUID();
    await base44.asServiceRole.entities.SurveyInvite.create({
      token, email, client_id: send.client_id, service_id: send.service_id,
      survey_type: send.send_type, instruments,
      event_id: send.event_id || undefined,
      scheduled_send_id: send.id, created_at: new Date().toISOString()
    });
    try {
      await sendSurveyEmail(email, send.send_type, token, { ...sessionCtx, name });
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

  // Names are collected alongside emails so the email can greet people by name.
  // Keyed by email because that stays the dedup key; last non-empty name wins.
  const nameByEmail = {};
  const remember = (email, name) => {
    if (email && name && !nameByEmail[email]) nameByEmail[email] = name;
  };

  if (send.send_type === 'enps_post_session' || send.send_type === 'post_session_pulse') {
    const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: send.event_id });
    for (const c of checkins) {
      if (c.is_demo) continue;
      const e = (c.email || '').toLowerCase().trim();
      if (!e) continue;
      candidates.push(e);
      remember(e, c.name);
    }
  } else {
    // cohort_end / cohort_1mo: all distinct emails across engagement for client + service
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ client_id: send.client_id });
    const matchingEventIds = events.filter(e => !e.is_demo && e.service_id === send.service_id).map(e => e.id);

    for (const eid of matchingEventIds) {
      const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: eid });
      for (const c of checkins) {
        if (c.is_demo) continue;
        const e = (c.email || '').toLowerCase().trim();
        if (!e) continue;
        candidates.push(e);
        remember(e, c.name);
      }
    }

    const assessments = await base44.asServiceRole.entities.CohortAssessment.filter({ client_id: send.client_id });
    candidates.push(...assessments.filter(a => !a.is_demo && a.service_id === send.service_id)
      .map(a => (a.participant_email || '').toLowerCase().trim()).filter(Boolean));
  }

  candidates = [...new Set(candidates)];

  // Exclude suppressed. Records with cleared_at were reinstated by an admin —
  // the row is kept as an audit trail of the original unsubscribe, not as an
  // active suppression, so it must not filter anyone out.
  const suppressedSet = await loadSuppressedSet(base44);
  candidates = candidates.filter(e => !suppressedSet.has(e));

  // Exclude already-submitted for this timing.
  // cohort_end / cohort_1mo are scoped to the send's service AND the event's plan year,
  // so a session_check (mid-program) or a prior-year completion doesn't suppress the
  // true endpoint email. enps_post_session keeps the original unscoped filter.
  // post_session_pulse has no CohortAssessment dedup by design (not in the map).
  const surveyTypeMap = { cohort_end: 'cohort_end', cohort_1mo: 'cohort_1mo', enps_post_session: 'enps_post_session' };
  const st = surveyTypeMap[send.send_type];
  if (st) {
    const dedupFilter = { client_id: send.client_id, survey_type: st };
    if (send.send_type === 'cohort_end' || send.send_type === 'cohort_1mo') {
      let cohortYear = new Date().getFullYear();
      if (send.event_id) {
        const ev = await base44.asServiceRole.entities.CalendarEvent.filter({ id: send.event_id });
        if (ev[0]?.start_date) cohortYear = new Date(ev[0].start_date).getFullYear();
      }
      dedupFilter.service_id = send.service_id;
      dedupFilter.cohort_year = cohortYear;
    }
    const submitted = await base44.asServiceRole.entities.CohortAssessment.filter(dedupFilter);
    const submittedSet = new Set(submitted.map(a => (a.participant_email || '').toLowerCase().trim()));
    candidates = candidates.filter(e => !submittedSet.has(e));
  }

  return candidates.map(email => ({ email, name: firstNameFrom(nameByEmail[email]) }));
}

// Single source of truth for "who must not be emailed". Used by both the initial
// send and the reminder pass — the reminder pass previously skipped this check
// entirely, which meant anyone who unsubscribed from a send still received its
// follow-up reminder two days later.
async function loadSuppressedSet(base44) {
  const suppressions = await base44.asServiceRole.entities.EmailSuppression.list();
  return new Set(
    suppressions
      .filter(s => !s.cleared_at)
      .map(s => (s.email || '').toLowerCase().trim())
      .filter(Boolean)
  );
}

async function getInstruments(base44, send) {
  if (send.send_type === 'enps_post_session') return ['enps'];
  if (send.send_type === 'post_session_pulse') return [];
  const services = send.service_id ? await base44.asServiceRole.entities.Service.filter({ id: send.service_id }) : [];
  const service = services[0];
  if (service?.included_assessments?.length) return service.included_assessments;
  return ['who5', 'enps'];
}

async function sendSurveyEmail(to, sendType, token, ctx = {}) {
  const surveyLink = sendType === 'post_session_pulse'
    ? `${APP_URL}/AttendeeForm?t=${token}`
    : `${APP_URL}/CohortAssessment?t=${token}`;
  const unsubLink = `${APP_URL}/Unsubscribe?email=${encodeURIComponent(to)}`;

  const subjects = {
    enps_post_session: 'One question about today\u2019s session',
    post_session_pulse: 'How was today\u2019s session?',
    cohort_end: 'How did your wellness program go?',
    cohort_1mo: 'How are things 30 days on?'
  };

  const intros = {
    enps_post_session: 'Thank you for attending today\u2019s session. We\u2019d love one quick piece of feedback.',
    post_session_pulse: 'Thank you for joining today\u2019s session. One quick reflection while it\u2019s fresh.',
    cohort_end: 'Your wellness program has wrapped up. We\u2019d value your input on the experience.',
    cohort_1mo: 'It\u2019s been about a month since your wellness program. We\u2019d love to check in.'
  };

  const durations = {
    enps_post_session: 'It\u2019s one question and takes about 10 seconds.',
    post_session_pulse: 'It takes about 30 seconds.',
    cohort_end: 'It takes less than 2 minutes.',
    cohort_1mo: 'It takes less than 2 minutes.'
  };

  const buttons = {
    enps_post_session: 'Answer one question',
    post_session_pulse: 'Share your takeaway',
    cohort_end: 'Take the survey',
    cohort_1mo: 'Take the survey'
  };

  const body = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#013f7c,#264d44);padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <img src="${APP_URL}/email-assets/skms-full-logo-white.png" alt="SkillfulMeans" style="height:44px;max-width:280px" />
    </div>
    <div style="background:#f9f9f9;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      ${greetingHtml(ctx.name)}
      <p style="color:#374151;font-size:15px;line-height:1.6">${intros[sendType]}</p>
      ${sessionBlockHtml(ctx)}
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
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  // cohort_end reminds at 3 days; post_session_pulse reminds at 2 days.
  await processReminderBatch(base44, 'cohort_end', new Date(now - 3 * DAY));
  await processReminderBatch(base44, 'post_session_pulse', new Date(now - 2 * DAY));
}

async function processReminderBatch(base44, sendType, cutoff) {
  const sentSends = await base44.asServiceRole.entities.ScheduledSurveySend.filter({
    send_type: sendType, status: 'sent', reminder_sent: false
  }, '-sent_at', 50);

  // Re-read per batch so an unsubscribe made after the initial send is honoured
  // by the reminder that follows it.
  const suppressedSet = await loadSuppressedSet(base44);

  for (const send of sentSends) {
    if (send.is_demo) continue;
    if (!send.sent_at || new Date(send.sent_at) > cutoff) continue;

    // Find non-responders who are still eligible to be emailed.
    const invites = await base44.asServiceRole.entities.SurveyInvite.filter({ scheduled_send_id: send.id });
    const nonResponders = invites.filter(
      i => !i.submitted_at && !suppressedSet.has((i.email || '').toLowerCase().trim())
    );
    if (nonResponders.length === 0) {
      await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, { reminder_sent: true });
      continue;
    }

    // Same session block and greeting as the original send, so the reminder is
    // recognisable rather than a context-free nudge. Names come from the
    // check-ins on the event, matched back to each invite by email.
    const sessionCtx = await buildSessionContext(base44, send);
    const nameByEmail = {};
    if (send.event_id) {
      const checkins = await base44.asServiceRole.entities.EventCheckin.filter({ event_id: send.event_id });
      for (const c of checkins) {
        const e = (c.email || '').toLowerCase().trim();
        if (e && c.name && !nameByEmail[e]) nameByEmail[e] = c.name;
      }
    }

    for (const invite of nonResponders) {
      try {
        const name = firstNameFrom(nameByEmail[(invite.email || '').toLowerCase().trim()]);
        await sendReminderEmail(invite.email, invite.token, sendType, { ...sessionCtx, name });
      } catch (err) { /* continue */ }
    }

    // Mark reminder as sent
    await base44.asServiceRole.entities.ScheduledSurveySend.update(send.id, { reminder_sent: true });
  }
}

async function sendReminderEmail(to, token, sendType = 'cohort_end', ctx = {}) {
  const isPulse = sendType === 'post_session_pulse';
  const surveyLink = isPulse
    ? `${APP_URL}/AttendeeForm?t=${token}`
    : `${APP_URL}/CohortAssessment?t=${token}`;
  const unsubLink = `${APP_URL}/Unsubscribe?email=${encodeURIComponent(to)}`;
  const subject = isPulse ? 'One quick reflection on your session' : 'Reminder: How did your wellness program go?';
  const intro = isPulse
    ? 'Just a friendly reminder \u2014 we\u2019d still love your quick reflection on your session.'
    : 'Just a friendly reminder \u2014 we\u2019d still love your feedback on your wellness program.';
  const buttonText = isPulse ? 'Share your takeaway' : 'Take the survey';
  const body = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#013f7c,#264d44);padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <img src="${APP_URL}/email-assets/skms-full-logo-white.png" alt="SkillfulMeans" style="height:44px;max-width:280px" />
    </div>
    <div style="background:#f9f9f9;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
      ${greetingHtml(ctx.name)}
      <p style="color:#374151;font-size:15px;line-height:1.6">${intro}</p>
      ${sessionBlockHtml(ctx)}
      <a href="${surveyLink}" style="display:inline-block;background:#264d44;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:16px 0">${buttonText}</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px"><a href="${unsubLink}" style="color:#9ca3af">Unsubscribe</a></p>
    </div>
  </div>`;

  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
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