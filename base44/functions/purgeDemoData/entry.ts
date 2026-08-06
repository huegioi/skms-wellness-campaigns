import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEMO_TAG = 'Demo';

// Every entity the seed writes is_demo records into. deleteMany({ is_demo: true })
// removes all matches in a single call per entity (vs hundreds of delete-by-ID
// calls that rate-limit on large seeds). We loop + verify because deleteMany
// may be internally capped, and because some automation-created ClientTasks
// can reference a demo client_id without carrying is_demo themselves.
const ENTITIES = [
  'ClientTask', 'CohortAssessment', 'FeedbackResponse', 'EventCheckin', 'CalendarEvent',
  'Invoice', 'Proposal', 'ReferralActivity', 'Referral', 'MfsAssessment', 'MfsJourney',
  'Lead', 'Client', 'ReferralPartner',
];

async function purgeEntity(base44, entityName) {
  // Count what's there first (reported back to the caller).
  const before = await base44.asServiceRole.entities[entityName]
    .filter({ is_demo: true }, '-created_date', 1000)
    .catch(() => []);
  const total = before.length;
  if (!total) return 0;
  // deleteMany rounds until no is_demo records remain (handles internal caps).
  for (let attempt = 0; attempt < 6; attempt++) {
    await base44.asServiceRole.entities[entityName].deleteMany({ is_demo: true }).catch(() => {});
    const after = await base44.asServiceRole.entities[entityName]
      .filter({ is_demo: true }, '-created_date', 1)
      .catch(() => []);
    if (!after.length) break;
  }
  return total;
}

// ClientTasks: automation-created tasks may carry is_demo:false but reference a
// demo client_id. Sweep those by client_id so nothing demo-owned survives.
async function purgeStrayTasks(base44) {
  const demoClients = await base44.asServiceRole.entities.Client.filter({ is_demo: true }, '-created_date', 1000).catch(() => []);
  let removed = 0;
  for (const c of demoClients) {
    const tasks = await base44.asServiceRole.entities.ClientTask.filter({ client_id: c.id }, '-created_date', 1000).catch(() => []);
    for (const t of tasks) {
      await base44.asServiceRole.entities.ClientTask.delete(t.id).catch(() => {});
      removed++;
    }
  }
  return removed;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }

    const counts = {};
    const errors = [];
    for (const e of ENTITIES) {
      try {
        counts[e] = await purgeEntity(base44, e);
      } catch (err) {
        errors.push(e + ': ' + err.message);
        counts[e] = 0;
      }
    }

    // Stray non-is_demo tasks owned by demo clients (caught after clients are known).
    try {
      const stray = await purgeStrayTasks(base44);
      if (stray) counts.ClientTask = (counts.ClientTask || 0) + stray;
    } catch (err) {
      errors.push('ClientTask(stray): ' + err.message);
    }

    // Demo tag.
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