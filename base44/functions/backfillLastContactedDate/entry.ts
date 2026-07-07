import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // One-time backfill: for clients where last_contacted (datetime) is newer than
    // last_contacted_date (date), or last_contacted_date is empty, copy the date part over.
    const clients = await base44.asServiceRole.entities.Client.list();
    let updated = 0;
    let skipped = 0;

    for (const client of clients) {
      const legacy = client.last_contacted;
      const current = client.last_contacted_date;

      if (!legacy) {
        skipped++;
        continue;
      }

      const legacyDate = new Date(legacy).toISOString().split('T')[0];

      // Copy if current is empty, or legacy is newer
      if (!current || legacyDate > current) {
        await base44.asServiceRole.entities.Client.update(client.id, {
          last_contacted_date: legacyDate,
        });
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`[backfillLastContactedDate] Updated ${updated} clients, skipped ${skipped} (already current or no legacy date).`);
    return Response.json({
      success: true,
      updated,
      skipped,
      total: clients.length,
    });
  } catch (error) {
    console.error('backfillLastContactedDate error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});