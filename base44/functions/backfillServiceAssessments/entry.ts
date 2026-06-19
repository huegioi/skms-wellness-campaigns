import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULTS = {
  workshop:    ['enps'],
  class:       ['enps'],
  leadership:  ['enps', 'uwes3'],
  challenge:   ['who5'],
  wellness_box: [],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const services = await base44.asServiceRole.entities.Service.filter({});
    let updated = 0;

    for (const svc of services) {
      if (svc.included_assessments && svc.included_assessments.length > 0) continue;
      const defaults = DEFAULTS[svc.category];
      if (!defaults || defaults.length === 0) continue;
      await base44.asServiceRole.entities.Service.update(svc.id, { included_assessments: defaults });
      updated++;
    }

    return Response.json({ updated, total: services.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});