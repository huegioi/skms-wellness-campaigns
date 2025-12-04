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
      return Response.json({ error: 'Gmail credentials not configured' }, { status: 500 });
    }

    // Create email in RFC 2822 format
    const emailLines = [
      `From: ${gmailAddress}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      body
    ];
    const rawEmail = emailLines.join('\r\n');
    
    // Base64url encode
    const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Use Google Calendar OAuth token (same Google account)
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlecalendar");
    
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gmail API error:', response.status, errorText);
      
      // If Gmail API fails, fallback to built-in email for app users
      if (response.status === 403 || response.status === 401) {
        // Try the built-in integration as fallback
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: to,
          subject: subject,
          body: body
        });
        return Response.json({ success: true, method: 'fallback' });
      }
      
      return Response.json({ error: `Gmail API: ${response.status}` }, { status: 500 });
    }

    return Response.json({ success: true, method: 'gmail' });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});