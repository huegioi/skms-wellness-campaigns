import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { SMTPClient } from 'npm:emailjs@4.0.3';

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

    const client = new SMTPClient({
      user: gmailAddress,
      password: gmailAppPassword,
      host: 'smtp.gmail.com',
      ssl: true,
    });

    await client.sendAsync({
      from: gmailAddress,
      to: to,
      subject: subject,
      attachment: [
        { data: body, alternative: true }
      ]
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});