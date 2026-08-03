import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// One-off: removes 'enps' from Service.included_assessments everywhere it
// still appears. eNPS is now collected automatically post-session and removed
// from the service-level picker, so it should not be stored on services.
// Not run automatically — invoke once from the admin UI.

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !isTeamMember(user)) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const services = await base44.asServiceRole.entities.Service.filter({});
    let updated = 0;
    const changed = [];

    for (const svc of services) {
      const current = svc.included_assessments || [];
      if (!current.includes('enps')) continue;
      const next = current.filter(a => a !== 'enps');
      await base44.asServiceRole.entities.Service.update(svc.id, { included_assessments: next });
      updated++;
      changed.push({ id: svc.id, name: svc.name, category: svc.category, before: current, after: next });
    }

    return Response.json({ success: true, updated, total: services.length, changed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});