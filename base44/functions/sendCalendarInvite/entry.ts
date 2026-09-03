import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Manual-trigger calendar invite (the "Send Invite by Email" button). Never automatic.
//
// Rebuilt 2026-09-03 after a live test surfaced three real bugs:
//   1. Subject line arrived as mojibake ("Ã¢Â€Â" for an em-dash) — a raw UTF-8 Subject
//      header has no charset, so clients read the bytes as latin-1. Now RFC 2047 encoded.
//   2. The .ics never attached despite the body promising it — the parts carried 8-bit
//      UTF-8 with no Content-Transfer-Encoding and unwrapped base64. Both parts are now
//      base64 with proper 76-char line folding and consistent CRLF.
//   3. Times displayed in UTC (a 12:00 ET session read "04:00 PM"). Now America/New_York.
// Also added per William: an "Open in Google Calendar" link and, for presenters, their
// own portal link.

const APP_URL = Deno.env.get('APP_URL') || 'https://app.skillfulmeans.life';
const CALENDAR_ID = 'admin@skillfulmeans.life';
const NY = 'America/New_York';

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// UTF-8 safe base64 (btoa is latin-1 only).
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
// RFC 2045: base64 bodies must be folded at 76 characters.
const foldB64 = (s) => (s.match(/.{1,76}/g) || []).join('\r\n');
// RFC 2047 encoded-word — what keeps em-dashes and accents readable in a Subject.
const encodeHeader = (s) => /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;

// Google's own event URL: base64("<eventId> <calendarId>"), padding stripped.
function googleCalendarUrl(eventId) {
  if (!eventId) return '';
  return `https://www.google.com/calendar/event?eid=${b64(`${eventId} ${CALENDAR_ID}`).replace(/=+$/, '')}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { eventId, recipientEmails, recipientNames } = await req.json();
    if (!eventId || !recipientEmails?.length) {
      return Response.json({ error: 'eventId and recipientEmails required' }, { status: 400 });
    }

    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: eventId });
    const event = events[0];
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

    if (event.is_demo) {
      return Response.json({ error: 'Demo events cannot send calendar invites' }, { status: 403 });
    }

    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatICS = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const dayLabel = startDate.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: NY,
    });
    const timeOf = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: NY });
    const whenLabel = event.all_day
      ? dayLabel
      : `${dayLabel} · ${timeOf(startDate)} – ${timeOf(endDate)} ET`;

    // Presenters are attendees on the Meet holder event, not on the client-facing one,
    // so each recipient gets the calendar link they can actually open.
    const clientEventUrl = googleCalendarUrl(event.google_event_id);
    const holderEventUrl = googleCalendarUrl(event.google_meet_event_id);

    // Resolve presenters once so a recipient can be matched to their own portal.
    const presenters = await base44.asServiceRole.entities.Presenter.list('name', 500).catch(() => []);
    const presenterByEmail = new Map(
      presenters.filter(p => p.email).map(p => [p.email.trim().toLowerCase(), p])
    );

    // RFC 5545 escape + fold (backend can't import from src/)
    const icsEscape = (value) => String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
    const icsFold = (line) => {
      if (line.length <= 75) return line;
      const out = [line.slice(0, 75)];
      let rest = line.slice(75);
      while (rest.length > 74) { out.push(' ' + rest.slice(0, 74)); rest = rest.slice(74); }
      if (rest.length) out.push(' ' + rest);
      return out.join('\r\n');
    };

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];
    for (let i = 0; i < recipientEmails.length; i++) {
      const toEmail = recipientEmails[i];
      // A missing name greets nobody rather than greeting an email address or
      // an organization. `event.client_name` is the CLIENT (the company), so a
      // caller must pass a resolved human name here or pass nothing at all.
      const rawName = (recipientNames?.[i] || '').trim();
      const toName = rawName && !rawName.includes('@') ? rawName : '';

      const presenter = presenterByEmail.get((toEmail || '').trim().toLowerCase()) || null;
      const isPresenter = !!presenter;
      const calendarUrl = isPresenter ? (holderEventUrl || clientEventUrl) : clientEventUrl;
      const portalUrl = presenter?.unique_portal_id
        ? `${APP_URL}/PresenterPortal?id=${encodeURIComponent(presenter.unique_portal_id)}`
        : '';

      // Per-recipient ICS so the description carries the links that apply to them.
      const icsDescription = [
        event.description || '',
        calendarUrl ? `Google Calendar: ${calendarUrl}` : '',
        isPresenter && portalUrl ? `Your presenter portal: ${portalUrl}` : '',
      ].filter(Boolean).join('\n\n');

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SkillfulMeans//Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        icsFold(`DTSTAMP:${icsEscape(formatICS(new Date()))}`),
        icsFold(`DTSTART:${icsEscape(formatICS(startDate))}`),
        icsFold(`DTEND:${icsEscape(formatICS(endDate))}`),
        icsFold(`SUMMARY:${icsEscape(event.title)}`),
        icsFold(`DESCRIPTION:${icsEscape(icsDescription)}`),
        icsFold(`LOCATION:${icsEscape(event.location || '')}`),
        icsFold(`ORGANIZER;CN=SkillfulMeans:mailto:${CALENDAR_ID}`),
        icsFold(`ATTENDEE;CN=${icsEscape(toName || toEmail)};RSVP=TRUE:mailto:${toEmail}`),
        icsFold(`UID:${icsEscape(event.id)}-${isPresenter ? 'presenter' : 'client'}@skms-wellness`),
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const linkButton = (href, label, bg) => `
              <a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:8px;margin:0 8px 8px 0;">${label}</a>`;

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #013f7c, #264d44); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Calendar Invite</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151;">${toName ? `Hi ${escapeHtml(toName)},` : 'Hi there,'}</p>
            <p style="color: #374151;">${isPresenter ? "You're presenting the following session:" : 'You have been invited to the following event:'}</p>
            <div style="background: white; border-left: 4px solid #013f7c; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #013f7c; margin: 0 0 12px 0; font-size: 18px;">${escapeHtml(event.title)}</h2>
              <p style="margin: 6px 0; color: #4b5563;"><strong>When:</strong> ${escapeHtml(whenLabel)}</p>
              ${event.client_name ? `<p style="margin: 6px 0; color: #4b5563;"><strong>Client:</strong> ${escapeHtml(event.client_name)}</p>` : ''}
              ${event.presenter ? `<p style="margin: 6px 0; color: #4b5563;"><strong>Presenter:</strong> ${escapeHtml(event.presenter)}</p>` : ''}
              ${event.description ? `<p style="margin: 12px 0 0; color: #4b5563; white-space: pre-wrap;">${escapeHtml(event.description)}</p>` : ''}
            </div>

            <div style="margin: 22px 0 8px;">
              ${calendarUrl ? linkButton(calendarUrl, 'Open in Google Calendar', '#013f7c') : ''}
              ${isPresenter && portalUrl ? linkButton(portalUrl, 'Accept or decline', '#770142') : ''}
            </div>

            ${isPresenter && event.meeting_link ? `<p style="color:#4b5563;font-size:14px;margin:14px 0 0;"><strong>Video link:</strong> <a href="${escapeHtml(event.meeting_link)}" style="color:#013f7c;">${escapeHtml(event.meeting_link.replace(/^https?:\/\//, ''))}</a><br><span style="color:#6b7280;font-size:13px;">Attendees join separately after they check in, so they may arrive a few minutes after the start time.</span></p>` : ''}

            <p style="color: #6b7280; font-size: 14px; margin-top: 18px;">A calendar file (.ics) is attached — open it to add this to any calendar app.</p>
            <p style="color: #374151;">Best regards,<br><strong>SkillfulMeans</strong></p>
          </div>
        </div>
      `.trim();

      const boundary = `skms_${Date.now()}_${i}`;
      const rawEmail = [
        `To: ${toEmail}`,
        'From: SkillfulMeans <me>',
        `Subject: ${encodeHeader(`Calendar Invite: ${event.title}`)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        foldB64(b64(emailBody)),
        '',
        `--${boundary}`,
        'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="invite.ics"',
        'Content-Disposition: attachment; filename="invite.ics"',
        'Content-Transfer-Encoding: base64',
        '',
        foldB64(b64(icsContent)),
        '',
        `--${boundary}--`,
        '',
      ].join('\r\n');

      const encodedEmail = b64(rawEmail)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const gmailResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedEmail }),
      });

      const gmailData = await gmailResp.json();
      results.push({
        email: toEmail,
        success: !!gmailData.id,
        id: gmailData.id,
        role: isPresenter ? 'presenter' : 'client',
        calendarUrl: calendarUrl || null,
        portalUrl: portalUrl || null,
        error: gmailData.error?.message || undefined,
      });
    }

    return Response.json({ success: results.some(r => r.success), results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
