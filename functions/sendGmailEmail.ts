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

    const apiKey = Deno.env.get('MAILGUN_API_KEY');
    const domain = Deno.env.get('MAILGUN_DOMAIN');

    if (!apiKey || !domain) {
      return Response.json({ error: 'Mailgun credentials not configured' }, { status: 500 });
    }

    const formData = new FormData();
    formData.append('from', `SkillfulMeans Wellness <mailgun@${domain}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', body);

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mailgun error:', response.status, errorText);
      return Response.json({ error: `Mailgun: ${errorText}` }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});