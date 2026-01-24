import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Toggle the automation
    const response = await fetch(`${Deno.env.get('BASE44_API_URL')}/automations/697435cc6df3932d19ca6a62/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.headers.get('authorization')?.replace('Bearer ', '')}`,
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