import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const apiKey = Deno.env.get('BASE44_API_KEY');
    const appId = Deno.env.get('BASE44_APP_ID');
    
    const response = await fetch(`https://api.base44.com/v1/apps/${appId}/automations`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const automations = await response.json();
    return Response.json(automations);

  } catch (error) {
    console.error('List error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});