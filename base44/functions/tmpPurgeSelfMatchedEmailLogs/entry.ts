import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// TEMPORARY one-off cleanup (2026-11-06). Delete this function after use.
// The email sync briefly matched a test Lead carrying william@skillfulmeans.life and
// logged William's whole mailbox (459 rows, created 15:21-15:23 UTC). This removes
// exactly those rows; the fixed sync re-logs the real contact emails on its next run.
const WINDOW = { $gte: '2026-11-06T15:21:00', $lte: '2026-11-06T15:24:00' };
const EXPECTED_MAX = 470; // safety: refuse to delete if the filter matches more than the bad run made

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rows = await base44.asServiceRole.entities.EmailLog.filter(
      { gmail_account: 'william', created_date: WINDOW }, '-created_date', 1000
    );
    const matched = rows?.length || 0;
    if (matched > EXPECTED_MAX) {
      console.error(`[tmpPurgeSelfMatchedEmailLogs] matched ${matched} rows, more than expected; deleted nothing`);
      return Response.json({ error: 'too many matches', matched }, { status: 400 });
    }
    let deleted = 0;
    for (const r of rows || []) {
      await base44.asServiceRole.entities.EmailLog.delete(r.id);
      deleted++;
    }
    console.log(`[tmpPurgeSelfMatchedEmailLogs] matched ${matched}, deleted ${deleted}`);
    return Response.json({ matched, deleted });
  } catch (error) {
    console.error('tmpPurgeSelfMatchedEmailLogs error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
