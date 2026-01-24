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
    
    const response = await fetch(`https://api.base44.com/v1/apps/${appId}/automations/697435cc6df3932d19ca6a62`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get automation status');
    }

    const automation = await response.json();
    
    return Response.json({
      success: true,
      isActive: automation.is_active
    });

  } catch (error) {
    console.error('Status check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});