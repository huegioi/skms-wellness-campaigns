import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEMO_TAG = 'Demo';
const BATCH = 5;

// Delete every record flagged is_demo, plus any tasks belonging to demo clients
// (automation-created tasks may carry is_demo=false but reference a demo client_id).
// deleteMany is unreliable here, so we delete by ID in parallel batches instead.
async function deleteByEntity(base44, entityName, records) {
  const ids = [...new Set(records.map((r) => r.id).filter(Boolean))];
  const errors = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await Promise.all(batch.map((id) =>
      base44.asServiceRole.entities[entityName].delete(id).catch((e) => errors.push(e.message))
    ));
  }
  return { found: ids.length, deleted: ids.length - errors.length, errors };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }

    const entities = [
      'ClientTask', 'CohortAssessment', 'FeedbackResponse', 'CalendarEvent',
      'Proposal', 'ReferralActivity', 'Referral', 'MfsAssessment', 'MfsJourney', 'Lead', 'Client', 'ReferralPartner',
    ];

    // ── Parallel reads: demo clients (for task lookup) + every entity's is_demo records ──
    const demoClients = await base44.asServiceRole.entities.Client.filter({ is_demo: true }, '-created_date', 1000);
    const demoClientIds = demoClients.map((c) => c.id);

    // Tasks: per demo client (catches automation-created tasks) + any is_demo tasks
    const taskFetches = demoClientIds.map((cid) =>
      base44.asServiceRole.entities.ClientTask.filter({ client_id: cid }, '-created_date', 1000).catch(() => [])
    );
    const taskResults = await Promise.all([
      ...taskFetches,
      base44.asServiceRole.entities.ClientTask.filter({ is_demo: true }, '-created_date', 1000).catch(() => []),
    ]);
    const taskRecords = taskResults.flat();

    // Fetch the remaining entities' demo records in parallel
    const restEntities = entities.filter((e) => e !== 'ClientTask');
    const restRecs = await Promise.all(
      restEntities.map((e) => base44.asServiceRole.entities[e].filter({ is_demo: true }, '-created_date', 1000).catch(() => []))
    );
    const recordsByEntity = { ClientTask: taskRecords };
    restEntities.forEach((e, i) => { recordsByEntity[e] = restRecs[i]; });

    // ── Sequential per-entity delete-by-ID (parallel within each batch) ──
    const counts = {};
    const errors = [];
    for (const e of entities) {
      const res = await deleteByEntity(base44, e, recordsByEntity[e] || []);
      counts[e] = res.deleted;
      if (res.errors.length) errors.push(e + ': ' + res.errors[0] + (res.errors.length > 1 ? ' (+' + (res.errors.length - 1) + ' more)' : ''));
    }

    // ── Demo tag ──
    let tagDeleted = 0;
    try {
      const demoTags = await base44.asServiceRole.entities.Tag.filter({ name: DEMO_TAG });
      for (const t of demoTags) {
        await base44.asServiceRole.entities.Tag.delete(t.id);
        tagDeleted++;
      }
    } catch (e) {
      errors.push('Tag: ' + e.message);
    }
    counts.Tag = tagDeleted;

    return Response.json({
      success: errors.length === 0,
      deleted: counts,
      errors,
    });
  } catch (error) {
    console.error('purgeDemoData error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});