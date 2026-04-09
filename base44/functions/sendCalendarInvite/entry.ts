import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { eventId, recipientEmails, recipientNames } = await req.json();
    if (!eventId || !recipientEmails?.length) {
      return Response.json({ error: 'eventId and recipientEmails required' }, { status: 400 });
    }

    const events = await base44.entities.CalendarEvent.filter({ id: eventId });
    const event = events[0];
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatICS = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const formatDisplay = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SKMS Wellness//Calendar//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `DTSTART:${formatICS(startDate)}`,
      `DTEND:${formatICS(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${event.location || ''}`,
      `UID:${event.id}@skms-wellness`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];
    for (let i = 0; i < recipientEmails.length; i++) {
      const toEmail = recipientEmails[i];
      const toName = recipientNames?.[i] || toEmail;

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #013f7c, #264d44); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📅 Calendar Invite</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
            <p style="color: #374151;">Hi ${toName},</p>
            <p style="color: #374151;">You have been invited to the following event:</p>
            <div style="background: white; border-left: 4px solid #013f7c; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #013f7c; margin: 0 0 12px 0;">${event.title}</h2>
              <p style="margin: 6px 0; color: #4b5563;">🗓 <strong>When:</strong> ${formatDisplay(startDate)}</p>
              ${event.location ? `<p style="margin: 6px 0; color: #4b5563;">📍 <strong>Where:</strong> ${event.location}</p>` : ''}
              ${event.client_name ? `<p style="margin: 6px 0; color: #4b5563;">👤 <strong>Client:</strong> ${event.client_name}</p>` : ''}
              ${event.presenter ? `<p style="margin: 6px 0; color: #4b5563;">🎤 <strong>Presenter:</strong> ${event.presenter}</p>` : ''}
              ${event.description ? `<p style="margin: 12px 0 0; color: #4b5563; white-space: pre-wrap;">${event.description}</p>` : ''}
            </div>
            <p style="color: #6b7280; font-size: 14px;">A calendar file (.ics) is attached. Open it to add this event to your calendar.</p>
            <p style="color: #374151;">Best regards,<br><strong>SKMS Wellness</strong></p>
          </div>
        </div>
      `;

      const boundary = `boundary_${Date.now()}`;
      const rawEmail = [
        `To: ${toEmail}`,
        `From: SKMS Wellness <me>`,
        `Subject: Calendar Invite: ${event.title}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        emailBody,
        '',
        `--${boundary}`,
        'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST',
        `Content-Disposition: attachment; filename="invite.ics"`,
        'Content-Transfer-Encoding: base64',
        '',
        icsBase64,
        '',
        `--${boundary}--`
      ].join('\r\n');

      const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const gmailResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedEmail })
      });

      const gmailData = await gmailResp.json();
      results.push({ email: toEmail, success: !!gmailData.id, id: gmailData.id });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});