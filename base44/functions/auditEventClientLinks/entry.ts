import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    // Fetch all calendar events (read-only, high limit per request).
    const events = await base44.asServiceRole.entities.CalendarEvent.list('-created_date', 2000);

    // Fetch all clients once for matching (read-only).
    const clients = await base44.asServiceRole.entities.Client.list('-created_date', 2000);

    // Build lookup sets (case-insensitive) for client name and company.
    const clientNamesLower = new Set();
    const clientCompaniesLower = new Set();
    for (const c of clients) {
      if (c.name && String(c.name).trim()) clientNamesLower.add(String(c.name).trim().toLowerCase());
      if (c.company && String(c.company).trim()) clientCompaniesLower.add(String(c.company).trim().toLowerCase());
    }

    const total = events.length;
    const nullClientIdEvents = events.filter(e => !e.client_id);
    const nullCount = nullClientIdEvents.length;
    const withClientName = nullClientIdEvents.filter(e => e.client_name && String(e.client_name).trim());
    const withClientNameCount = withClientName.length;

    // Distinct client_name values with null client_id + count + match check.
    const nameMap = new Map(); // lowercased name -> { display, count }
    for (const e of withClientName) {
      const display = String(e.client_name).trim();
      const key = display.toLowerCase();
      const entry = nameMap.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        nameMap.set(key, { display, count: 1 });
      }
    }

    const distinctNames = [];
    for (const [key, entry] of nameMap.entries()) {
      const matchesName = clientNamesLower.has(key);
      const matchesCompany = clientCompaniesLower.has(key);
      distinctNames.push({
        client_name: entry.display,
        count: entry.count,
        matches_client_name: matchesName,
        matches_client_company: matchesCompany,
        match_found: matchesName || matchesCompany,
      });
    }
    // Sort by count desc, then name asc.
    distinctNames.sort((a, b) => b.count - a.count || a.client_name.localeCompare(b.client_name));

    // Future vs past (based on start_date).
    const now = new Date();
    let futureCount = 0;
    let pastCount = 0;
    let noDateCount = 0;
    for (const e of nullClientIdEvents) {
      if (!e.start_date) { noDateCount += 1; continue; }
      const d = new Date(e.start_date);
      if (isNaN(d.getTime())) { noDateCount += 1; continue; }
      if (d >= now) futureCount += 1; else pastCount += 1;
    }

    return Response.json({
      total_events: total,
      events_with_null_client_id: nullCount,
      of_those_with_client_name: withClientNameCount,
      of_those_without_client_name: nullCount - withClientNameCount,
      future_events_with_null_client_id: futureCount,
      past_events_with_null_client_id: pastCount,
      no_date_with_null_client_id: noDateCount,
      distinct_client_names_with_null_client_id: distinctNames,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});