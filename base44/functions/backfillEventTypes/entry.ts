import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Keyword → event_type mapping (order matters: more specific first)
    const KEYWORD_MAP = [
      { keywords: ['challenge'], type: 'challenge' },
      { keywords: ['leadership'], type: 'leadership' },
      { keywords: ['lunch & learn', 'lunch and learn'], type: 'presentation' },
      { keywords: ['presentation'], type: 'presentation' },
      { keywords: ['class'], type: 'class' },
      { keywords: ['training'], type: 'workshop' },
      { keywords: ['workshop'], type: 'workshop' },
    ];

    // Fetch all calendar events (service role to bypass RLS)
    const allEvents = await base44.asServiceRole.entities.CalendarEvent.list('-created_date', 2000);

    // Filter to candidates: missing/empty/other event_type
    const candidates = allEvents.filter(e =>
      !e.event_type || e.event_type === '' || e.event_type === 'other'
    );

    const updates = [];
    for (const event of candidates) {
      if (!event.title) continue;
      const lower = event.title.toLowerCase();
      for (const { keywords, type } of KEYWORD_MAP) {
        if (keywords.some(kw => lower.includes(kw))) {
          updates.push({ id: event.id, event_type: type, title: event.title });
          break;
        }
      }
    }

    // Apply updates in bulk
    if (updates.length > 0) {
      await base44.asServiceRole.entities.CalendarEvent.bulkUpdate(updates);
    }

    return Response.json({
      scanned: allEvents.length,
      candidates: candidates.length,
      updated: updates.length,
      details: updates.map(u => ({ id: u.id, title: u.title, new_type: u.event_type })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});