import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const automations = await base44.asServiceRole.automations.list();
    
    return Response.json(automations);

  } catch (error) {
    console.error('List error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});