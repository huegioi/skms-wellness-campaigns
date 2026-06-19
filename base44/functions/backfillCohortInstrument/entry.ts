import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const rows = await base44.asServiceRole.entities.CohortAssessment.filter({});
    let updated = 0;

    for (const row of rows) {
      if (row.instrument) continue;
      if (row.who5_total == null) continue;

      await base44.asServiceRole.entities.CohortAssessment.update(row.id, {
        instrument: 'who5',
        instrument_total: row.who5_total,
      });
      updated++;
    }

    return Response.json({ updated, total: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});