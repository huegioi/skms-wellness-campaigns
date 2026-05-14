import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, from_name, from_email } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    const apiKey = Deno.env.get('SENDGRID_API_KEY');

    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: {
        email: from_email || 'admin@skillfulmeans.life',
        name: from_name || 'SKMS Wellness'
      },
      subject,
      content: [{ type: 'text/html', value: body }]
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ error: 'SendGrid error', details: errorText }, { status: response.status });
    }

    return Response.json({ success: true, message: `Email sent to ${to}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});