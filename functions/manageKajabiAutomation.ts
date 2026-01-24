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
    
    const result = await base44.asServiceRole.automations.manage(automationId, action);
    
    return Response.json(result);

  } catch (error) {
    console.error('Manage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});