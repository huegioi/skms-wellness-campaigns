import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const automationId = '697435cc6df3932d19ca6a62';
    
    // Get current automation state
    const automation = await base44.asServiceRole.automations.get(automationId);
    const newState = !automation.is_active;
    
    // Toggle it
    await base44.asServiceRole.automations.update(automationId, {
      is_active: newState
    });
    
    return Response.json({
      success: true,
      isActive: newState
    });

  } catch (error) {
    console.error('Toggle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});