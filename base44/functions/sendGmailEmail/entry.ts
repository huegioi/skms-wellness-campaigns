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

    console.log('Mailgun config:', { domain, hasApiKey: !!apiKey, apiKeyLength: apiKey?.length });
    console.log('Email body preview (first 500 chars):', body?.substring(0, 500));

    if (!apiKey || !domain) {
      return Response.json({ error: 'Mailgun credentials not configured' }, { status: 500 });
    }

    const formData = new FormData();
    formData.append('from', `SkillfulMeans Wellness <mailgun@${domain}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', body);

    // Try US region first, then EU if needed
    let response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`
      },
      body: formData
    });

    // If US fails with 401/404, try EU region
    if (response.status === 401 || response.status === 404) {
      const euFormData = new FormData();
      euFormData.append('from', `SkillfulMeans Wellness <mailgun@${domain}>`);
      euFormData.append('to', to);
      euFormData.append('subject', subject);
      euFormData.append('html', body);
      
      response = await fetch(`https://api.eu.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${apiKey}`)}`
        },
        body: euFormData
      });
    }

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Mailgun error:', response.status, responseText);
      return Response.json({ 
        error: `Mailgun error (${response.status}): ${responseText}`,
        debug: { domain, status: response.status }
      }, { status: 500 });
    }

    return Response.json({ success: true, response: responseText });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});