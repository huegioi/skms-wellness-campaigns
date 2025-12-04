import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS');
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailAddress || !gmailAppPassword) {
      return Response.json({ error: 'Gmail credentials not configured. Address: ' + (gmailAddress ? 'set' : 'missing') + ', Password: ' + (gmailAppPassword ? 'set' : 'missing') }, { status: 500 });
    }

    // Use fetch to send via Gmail SMTP API
    const emailContent = [
      `From: ${gmailAddress}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Try using the Google Calendar OAuth token for Gmail
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlecalendar");
    
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gmail API error:', errorData);
      return Response.json({ error: `Gmail API error: ${response.status} - ${errorData}` }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});