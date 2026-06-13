import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Load all presenters and build lookup maps
    const allPresenters = await base44.asServiceRole.entities.Presenter.list('name', 500);

    // Full name map: lowercased full name -> presenter (only if unique)
    const fullNameMap = {};
    allPresenters.forEach(p => {
      const key = (p.name || '').trim().toLowerCase();
      if (key) {
        fullNameMap[key] = fullNameMap[key] ? null : p; // null = ambiguous
      }
    });

    // First name map: lowercased first name -> presenter (only if exactly one presenter has that first name)
    const firstNameCount = {};
    allPresenters.forEach(p => {
      const first = (p.name || '').trim().split(' ')[0].toLowerCase();
      if (first) firstNameCount[first] = (firstNameCount[first] || 0) + 1;
    });
    const firstNameMap = {};
    allPresenters.forEach(p => {
      const first = (p.name || '').trim().split(' ')[0].toLowerCase();
      if (first && firstNameCount[first] === 1) {
        firstNameMap[first] = p;
      }
    });

    // Fetch all CalendarEvents that have a presenter text but no presenter_id
    const allEvents = await base44.asServiceRole.entities.CalendarEvent.list('start_date', 2000);
    const toBackfill = allEvents.filter(e => e.presenter && !e.presenter_id);

    let linked = 0;
    let ambiguous = 0;
    const details = [];

    for (const event of toBackfill) {
      const presenterText = (event.presenter || '').trim();
      const presenterTextLower = presenterText.toLowerCase();
      const firstWord = presenterTextLower.split(' ')[0];

      let matched = null;
      let matchType = '';

      // Try full name match first
      if (fullNameMap[presenterTextLower]) {
        matched = fullNameMap[presenterTextLower];
        matchType = 'full_name';
      } else if (fullNameMap[presenterTextLower] === null) {
        // Ambiguous full name
        ambiguous++;
        details.push({ event_id: event.id, presenter_text: presenterText, result: 'ambiguous_full_name' });
        continue;
      }

      // Fall back to first name (only if unique)
      if (!matched && firstNameMap[firstWord]) {
        matched = firstNameMap[firstWord];
        matchType = 'first_name';
      }

      if (matched) {
        await base44.asServiceRole.entities.CalendarEvent.update(event.id, {
          presenter_id: matched.id,
          presenter: matched.name // normalize the name to the canonical full name
        });
        linked++;
        details.push({ event_id: event.id, presenter_text: presenterText, matched_to: matched.name, match_type: matchType });
      } else {
        details.push({ event_id: event.id, presenter_text: presenterText, result: 'no_match' });
      }
    }

    return Response.json({
      total_unlinked: toBackfill.length,
      linked,
      ambiguous,
      skipped_no_match: toBackfill.length - linked - ambiguous,
      details
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});