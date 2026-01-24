import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action } = await req.json();
    const automationId = '697435cc6df3932d19ca6a62';
    const apiKey = Deno.env.get('BASE44_API_KEY');
    const appId = Deno.env.get('BASE44_APP_ID');
    
    const response = await fetch(`https://api.base44.com/v1/apps/${appId}/automations/${automationId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    return Response.json(result);

  } catch (error) {
    console.error('Manage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});