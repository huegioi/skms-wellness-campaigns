import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Tells an assigned presenter they've been asked to deliver a session, and links them
// to their portal to accept or decline.
//
// MANUAL TRIGGER ONLY. William and Heather send by hand (see the no-auto-emails rule);
// this fires from the "Notify presenter" button in the event dialog, never on assignment.
//
// Channel-shaped on purpose: email ships now via SendGrid, SMS slots in as a second
// channel once Twilio + A2P 10DLC registration clears. Adding it means implementing
// sendSms() and adding it to the channels array — nothing else changes.
//
// preview=true renders exactly what would be sent and sends nothing.

const APP_URL = Deno.env.get('APP_URL') || 'https://app.skillfulmeans.life';
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = 'admin@skillfulmeans.life';
const FROM_NAME = 'SkillfulMeans';
const CALENDAR_ID = 'admin@skillfulmeans.life';

const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM  = Deno.env.get('TWILIO_FROM_NUMBER');

// Twilio only accepts E.164 (+16122371146). Presenter phones are free text
// ("612 237 1146", "8578911828"), so normalize before sending. US-default: a bare
// 10-digit number gets +1; 11 digits starting with 1 gets +. Anything else that
// doesn't already start with + we refuse rather than guess a country wrong.
function toE164(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) {
    const d = s.slice(1).replace(/\D/g, '');
    return d.length >= 8 && d.length <= 15 ? '+' + d : '';
  }
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  return '';
}

const NY = 'America/New_York';

// Google's own event URL is base64("<eventId> <calendarId>") with padding stripped.
// The presenter is an attendee on the Meet HOLDER event, not the client-facing one,
// so that's the event they can actually open.
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function googleCalendarUrl(eventId) {
  if (!eventId) return '';
  return `https://www.google.com/calendar/event?eid=${b64(`${eventId} ${CALENDAR_ID}`).replace(/=+$/, '')}`;
}

function fmtWhen(startIso, endIso, allDay) {
  const start = new Date(startIso);
  if (isNaN(start.getTime())) return { date: '', time: '', full: 'Date to be confirmed' };
  const date = start.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: NY,
  });
  if (allDay) return { date, time: '', full: date };

  const t = (d) => d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: NY,
  });
  const end = endIso ? new Date(endIso) : null;
  const time = end && !isNaN(end.getTime())
    ? `${t(start)} – ${t(end)} ET`
    : `${t(start)} ET`;
  return { date, time, full: `${date} · ${time}` };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmail({ presenterName, event, when, feeText, clientLabel, portalUrl, calendarUrl }) {
  const firstName = (presenterName || '').trim().split(/\s+/)[0] || 'there';
  const subject = `You're requested to present: ${event.title}`;

  const row = (label, value) => value
    ? `<tr>
         <td style="padding:9px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
         <td style="padding:9px 0;color:#111827;font-size:15px;font-weight:600;">${escapeHtml(value)}</td>
       </tr>`
    : '';

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#013f7c,#264d44);padding:26px 30px;border-radius:12px 12px 0 0;">
    <div style="color:#cfe0d9;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">SkillfulMeans</div>
    <h1 style="color:#fff;margin:0;font-size:22px;line-height:1.3;">You're requested to present</h1>
  </div>
  <div style="background:#ffffff;padding:28px 30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="color:#374151;font-size:15px;margin:0 0 18px;">Hi ${escapeHtml(firstName)},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 22px;">
      You've been requested to deliver the session below. Please accept or decline so we know whether to look for someone else.
    </p>

    <div style="background:#f7f7f4;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:16px;font-weight:700;color:#013f7c;line-height:1.35;margin-bottom:10px;">${escapeHtml(event.title)}</div>
      <table style="width:100%;border-collapse:collapse;">
        ${row('When', when.full)}
        ${row('Client', clientLabel)}
        ${row('Format', event.location && !/^https?:\/\//i.test(event.location) ? event.location : 'Virtual')}
        ${row('Your fee', feeText)}
      </table>
    </div>

    <a href="${portalUrl}"
       style="display:inline-block;background:#770142;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:8px;margin:0 8px 8px 0;">
      Accept or decline
    </a>
    ${calendarUrl ? `<a href="${calendarUrl}"
       style="display:inline-block;background:#013f7c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:8px;margin:0 8px 8px 0;">
      Open in Google Calendar
    </a>` : ''}

    ${event.meeting_link ? `<p style="color:#4b5563;font-size:14px;margin:20px 0 0;"><strong>Video link:</strong> <a href="${escapeHtml(event.meeting_link)}" style="color:#013f7c;">${escapeHtml(event.meeting_link.replace(/^https?:\/\//, ''))}</a></p>` : ''}

    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:16px 0 0;">
      The Google Meet room is already on your calendar for this session. Attendees join separately after they check in, so they may arrive a few minutes after the start time.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:18px 0 0;">
      If the button doesn't work, open this link:<br>
      <a href="${portalUrl}" style="color:#013f7c;word-break:break-all;">${portalUrl}</a>
    </p>
  </div>
</div>`.trim();

  const text = [
    `Hi ${firstName},`,
    ``,
    `You've been requested to deliver this SkillfulMeans session. Please accept or decline so we know whether to look for someone else.`,
    ``,
    event.title,
    when.full,
    clientLabel ? `Client: ${clientLabel}` : '',
    feeText ? `Your fee: ${feeText}` : '',
    ``,
    `Accept or decline: ${portalUrl}`,
    calendarUrl ? `Open in Google Calendar: ${calendarUrl}` : '',
    event.meeting_link ? `Video link: ${event.meeting_link}` : '',
    ``,
    `The Google Meet room is already on your calendar. Attendees join separately after they check in.`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

async function sendEmail({ to, toName, subject, html, text }) {
  if (!SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY is not configured' };
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, ...(toName ? { name: toName } : {}) }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });
  if (resp.ok) return { ok: true };
  const body = await resp.text().catch(() => '');
  return { ok: false, error: `SendGrid ${resp.status}: ${body.slice(0, 300)}` };
}

// Twilio REST call. Kept deliberately small: one message, no retries — a failed text
// must never block or fail the email, which is the channel that actually matters.
async function sendSms({ to, body }) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { ok: false, error: 'Twilio is not configured (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)', skipped: true };
  }
  const form = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (resp.ok) return { ok: true, sid: data.sid };
  // 21610 = the recipient replied STOP. Twilio blocks it at their end; we record it so
  // we stop trying and the UI can say why.
  return { ok: false, error: `Twilio ${data.code || resp.status}: ${data.message || 'send failed'}`, code: data.code };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { eventId, preview = false } = await req.json().catch(() => ({}));
    if (!eventId) return Response.json({ error: 'eventId is required' }, { status: 400 });

    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: eventId });
    const event = events?.[0];
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

    // Demo records never reach a real person.
    if (event.is_demo) {
      return Response.json({ error: 'This is a demo event — notifications are disabled on demo data.' }, { status: 403 });
    }

    if (!event.presenter_id && !event.presenter_email) {
      return Response.json({ error: 'No presenter is assigned to this session yet.' }, { status: 400 });
    }

    // Presenter record is the source of truth for contact details; the event's copy is
    // a snapshot that can lag if someone edited the presenter afterwards.
    let presenter = null;
    if (event.presenter_id) {
      const found = await base44.asServiceRole.entities.Presenter.filter({ id: event.presenter_id });
      presenter = found?.[0] || null;
    }

    const toEmail = (presenter?.email || event.presenter_email || '').trim();
    const presenterName = presenter?.name || event.presenter || '';

    if (!toEmail) {
      return Response.json({
        error: `${presenterName || 'This presenter'} has no email address on file. Add one on the Presenters page first.`,
      }, { status: 400 });
    }

    // Portal token is how they accept or decline. Generate one if the record predates it.
    let portalId = presenter?.unique_portal_id || '';
    if (presenter && !portalId) {
      portalId = crypto.randomUUID();
      await base44.asServiceRole.entities.Presenter.update(presenter.id, { unique_portal_id: portalId });
    }
    const portalUrl = portalId
      ? `${APP_URL}/PresenterPortal?id=${encodeURIComponent(portalId)}`
      : APP_URL;

    // Fee: the event override wins, else the presenter's default rate.
    const fee = event.presenter_fee != null ? event.presenter_fee : presenter?.default_rate;
    const feeText = fee != null && fee !== ''
      ? `$${Number(fee).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
      : '';

    const when = fmtWhen(event.start_date, event.end_date, event.all_day);
    const clientLabel = event.client_name || '';

    // Prefer the holder event (the presenter is an attendee there); fall back to the
    // client-facing event if this session has no Meet room yet.
    const calendarUrl = googleCalendarUrl(event.google_meet_event_id || event.google_event_id);

    const message = buildEmail({ presenterName, event, when, feeText, clientLabel, portalUrl, calendarUrl });

    // Text: short by design — one line of what, one of when, and the link that lets them
    // accept. 'Reply STOP to opt out' is a carrier requirement, not a nicety.
    const smsTo = presenter?.phone_e164 || toE164(presenter?.phone);
    const smsOptedIn = presenter?.sms_opt_in === true && !presenter?.sms_opt_out_at;
    const smsBody = `SkillfulMeans: you're requested to present "${event.title}" on ${when.date}${when.time ? ' at ' + when.time : ''}. Accept or decline: ${portalUrl}\nReply STOP to opt out.`;

    if (preview) {
      return Response.json({
        success: true,
        preview: true,
        to: { email: toEmail, name: presenterName },
        // Phone is surfaced so the dialog can say whether SMS would be possible later.
        phone: presenter?.phone || '',
        smsTo: smsTo || null,
        smsOptedIn,
        smsConfigured: !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM),
        smsBody: smsTo && smsOptedIn ? smsBody : null,
        smsBlockedReason: !smsTo
          ? (presenter?.phone ? 'phone number is not a valid US mobile' : 'no mobile number on file')
          : !presenter?.sms_opt_in ? 'presenter has not opted in to texts'
          : presenter?.sms_opt_out_at ? 'presenter replied STOP'
          : !(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) ? 'Twilio is not configured'
          : null,
        subject: message.subject,
        text: message.text,
        portalUrl,
        calendarUrl: calendarUrl || null,
        when: when.full,
        fee: feeText,
        alreadyNotifiedAt: event.presenter_notified_at || null,
      });
    }

    const channels = [];
    const emailResult = await sendEmail({
      to: toEmail,
      toName: presenterName,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    channels.push({ channel: 'email', target: toEmail, ...emailResult });

    // SMS is best-effort and additive: it never blocks the email and never fails the call.
    if (smsTo && smsOptedIn) {
      const smsResult = await sendSms({ to: smsTo, body: smsBody });
      channels.push({ channel: 'sms', target: smsTo, ...smsResult });
      if (smsResult.code === 21610 && presenter?.id) {
        await base44.asServiceRole.entities.Presenter.update(presenter.id, {
          sms_opt_out_at: new Date().toISOString(),
          sms_opt_in: false,
        }).catch(() => {});
      }
    }

    // Email is the channel that must land. A text failing on its own is 'partial', not
    // 'failed' — the presenter was still told.
    const emailOk = channels.find(c => c.channel === 'email')?.ok === true;
    const allOk = channels.every(c => c.ok);
    const anyOk = channels.some(c => c.ok);
    const status = allOk ? 'sent' : emailOk ? 'partial' : 'failed';
    const errorText = channels.filter(c => !c.ok).map(c => `${c.channel}: ${c.error}`).join('; ');

    await base44.asServiceRole.entities.CalendarEvent.update(eventId, {
      presenter_notified_at: anyOk ? new Date().toISOString() : (event.presenter_notified_at || null),
      presenter_notified_email: anyOk ? toEmail : (event.presenter_notified_email || ''),
      presenter_notify_status: status,
      presenter_notify_error: errorText,
    });

    return Response.json({
      success: anyOk,
      status,
      channels,
      to: { email: toEmail, name: presenterName },
      portalUrl,
      error: anyOk ? undefined : (errorText || 'Notification failed'),
    }, { status: anyOk ? 200 : 502 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
