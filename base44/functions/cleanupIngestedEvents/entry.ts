import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// One-time cleanup: deletes CalendarEvents that were auto-ingested from Google
// Calendar on 2026-07-07 but have no proposal/service link (personal events that
// slipped through the old loose matching rules). Run once, then re-run the
// ingestion backfill with the new strict rules.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all CalendarEvents (sorted newest-first so today's ingested events are on top)
    const allEvents = await base44.asServiceRole.entities.CalendarEvent.list('-created_date', 500);

    // Filter to ingestion-created events from 2026-07-07 with no proposal/service link
    const toDelete = allEvents.filter(ce =>
      ce.source_calendar &&
      !ce.proposal_id &&
      !ce.service_id &&
      ce.google_event_id &&
      ce.created_date &&
      ce.created_date.startsWith('2026-07-07')
    );

    console.log(`Found ${toDelete.length} ingested events from 2026-07-07 to clean up.`);

    const deleted = [];
    for (const ce of toDelete) {
      console.log(`Deleting: "${ce.title}" — start: ${ce.start_date} — created: ${ce.created_date}`);
      await base44.asServiceRole.entities.CalendarEvent.delete(ce.id);
      deleted.push({
        id: ce.id,
        title: ce.title,
        start_date: ce.start_date,
        created_date: ce.created_date,
        source_calendar: ce.source_calendar,
      });
    }

    console.log(`Cleanup complete. Deleted ${deleted.length} events.`);

    return Response.json({
      deleted_count: deleted.length,
      deleted,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});