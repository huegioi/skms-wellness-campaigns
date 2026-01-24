import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Use manage_automation tool via API
    const apiKey = Deno.env.get('BASE44_API_KEY');
    const appId = Deno.env.get('BASE44_APP_ID');
    
    const response = await fetch(`https://api.base44.com/v1/apps/${appId}/automations/697435cc6df3932d19ca6a62/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to toggle automation');
    }

    const result = await response.json();
    
    return Response.json({
      success: true,
      isActive: result.is_active
    });

  } catch (error) {
    console.error('Toggle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});