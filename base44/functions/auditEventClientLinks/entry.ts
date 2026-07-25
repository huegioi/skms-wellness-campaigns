import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

// ── Normalization helpers ──

// Credential suffixes to strip from comma-separated tails (e.g. "Jane Doe, MS, RD")
const CREDENTIAL_SUFFIXES = new Set([
  'ms', 'm.s.', 'rd', 'r.d.', 'cdn', 'mba', 'phd', 'ph.d.', 'lcsw', 'lmsw',
  'rn', 'np', 'pa', 'md', 'do', 'ncc', 'cce', 'chwc', 'acsm-cep', 'rdn',
  'ldn', 'cscs', 'ces', 'rph', 'dtr', 'cde', 'bcba', 'lcpc', 'lmft', 'psy.d.',
  'edd', 'm.ed.', 'ma', 'm.a.', 'bs', 'b.s.', 'msw', 'm.s.w.', 'rdn', 'ld',
]);

function normalizeKey(raw) {
  if (!raw) return '';
  let s = String(raw).toLowerCase().trim();
  // Extract parenthetical content first (before we strip it).
  const parenMatch = s.match(/\(([^)]+)\)/);
  const parenContent = parenMatch ? parenMatch[1].trim() : '';
  // Strip parentheticals.
  s = s.replace(/\([^)]*\)/g, ' ');
  // Strip comma-separated credential tails.
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    // Keep only parts that aren't credential suffixes.
    const kept = parts.filter(p => !CREDENTIAL_SUFFIXES.has(p.toLowerCase().replace(/\./g, '')));
    s = kept.length > 0 ? kept.join(' ') : parts[0];
  }
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();
  return { key: s, parenContent };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Forbidden — team members only' }, { status: 403 });

    // ── Fetch all entities (read-only, high limits) ──
    const [events, clients, partners, brokerages, leads] = await Promise.all([
      base44.asServiceRole.entities.CalendarEvent.list('-created_date', 2000),
      base44.asServiceRole.entities.Client.list('-created_date', 2000),
      base44.asServiceRole.entities.ReferralPartner.list('-created_date', 2000),
      base44.asServiceRole.entities.Brokerage.list('-created_date', 500),
      base44.asServiceRole.entities.Lead.list('-created_date', 2000),
    ]);

    // ── Build lookup indexes: normalized key → [{ entity_type, record_id, display }] ──
    const index = new Map(); // normalizedKey -> array of matches

    function addToIndex(rawName, rawCompany, entityType, recordId, display) {
      for (const raw of [rawName, rawCompany]) {
        if (!raw || !String(raw).trim()) continue;
        const { key, parenContent } = normalizeKey(raw);
        if (!key) continue;
        const entry = { entity_type: entityType, record_id: recordId, display: display || String(raw).trim() };
        const list = index.get(key) || [];
        // Dedup by record_id + entity_type.
        if (!list.some(m => m.record_id === recordId && m.entity_type === entityType)) {
          list.push(entry);
        }
        index.set(key, list);
        // Also index the parenthetical content as a separate candidate.
        if (parenContent) {
          const list2 = index.get(parenContent) || [];
          if (!list2.some(m => m.record_id === recordId && m.entity_type === entityType)) {
            list2.push(entry);
          }
          index.set(parenContent, list2);
        }
      }
    }

    for (const c of clients) {
      addToIndex(c.name, c.company, 'client', c.id, c.name || c.company);
    }
    for (const p of partners) {
      addToIndex(p.name, p.company, 'partner', p.id, p.name || p.company);
    }
    for (const b of brokerages) {
      addToIndex(b.name, b.company, 'brokerage', b.id, b.name || b.company);
    }
    for (const l of leads) {
      addToIndex(l.name, l.company, 'lead', l.id, l.name || l.company);
    }

    // ── Build all index keys as an array for fuzzy matching ──
    const allIndexKeys = Array.from(index.keys());

    // ── Find orphan events (null client_id) ──
    const total = events.length;
    const orphanEvents = events.filter(e => !e.client_id);
    const orphanCount = orphanEvents.length;
    const withName = orphanEvents.filter(e => e.client_name && String(e.client_name).trim());
    const withNameCount = withName.length;

    // ── Group by normalized candidate keys ──
    // For each event, generate candidate keys from client_name.
    // Group events by the PRIMARY key (first non-empty candidate), but match against ALL candidates.
    const groupMap = new Map(); // primaryKey -> { display, events: [...] }

    for (const e of withName) {
      const display = String(e.client_name).trim();
      const { key: primaryKey, parenContent } = normalizeKey(display);
      // Collect all candidate keys for this event.
      const candidates = [primaryKey];
      if (parenContent) candidates.push(parenContent);
      // Also add the raw lowercased display as a candidate (for cases where normalization changed something meaningful).
      const rawLower = display.toLowerCase().trim();
      if (rawLower && rawLower !== primaryKey) candidates.push(rawLower);

      const groupKey = primaryKey || rawLower || display.toLowerCase();
      let group = groupMap.get(groupKey);
      if (!group) {
        group = { display, candidates, events: [] };
        groupMap.set(groupKey, group);
      }
      group.events.push({
        event_id: e.id,
        title: e.title,
        start_date: e.start_date,
        is_future: e.start_date ? new Date(e.start_date) >= new Date() : false,
      });
    }

    // ── For each group, find exact matches and fuzzy suggestions ──
    const distinctNames = [];
    for (const group of groupMap.values()) {
      // Collect all exact matches across all candidate keys.
      const allMatches = [];
      const seenMatchKeys = new Set();
      for (const candKey of group.candidates) {
        const matches = index.get(candKey);
        if (matches) {
          for (const m of matches) {
            const mk = `${m.entity_type}:${m.record_id}`;
            if (!seenMatchKeys.has(mk)) {
              seenMatchKeys.add(mk);
              allMatches.push({ entity_type: m.entity_type, record_id: m.record_id, display: m.display });
            }
          }
        }
      }

      // Classify.
      let proposed_classification = 'unknown';
      const entityTypes = new Set(allMatches.map(m => m.entity_type));
      if (allMatches.length === 0) {
        proposed_classification = 'unknown';
      } else if (entityTypes.size > 1) {
        proposed_classification = 'ambiguous';
      } else {
        proposed_classification = Array.from(entityTypes)[0]; // client / partner / brokerage / lead
      }

      // Fuzzy suggestions: if no exact match, find up to 3 by edit distance ≤ 2.
      let fuzzy_suggestions = [];
      if (allMatches.length === 0) {
        const sugSet = new Map(); // key -> { key, entity_type, record_id, display, distance }
        for (const candKey of group.candidates) {
          if (!candKey || candKey.length < 3) continue;
          for (const idxKey of allIndexKeys) {
            if (!idxKey || idxKey.length < 3) continue;
            // Quick length filter.
            if (Math.abs(candKey.length - idxKey.length) > 2) continue;
            const dist = levenshtein(candKey, idxKey);
            if (dist > 0 && dist <= 2) {
              const matches = index.get(idxKey) || [];
              for (const m of matches) {
                const mk = `${m.entity_type}:${m.record_id}`;
                if (!sugSet.has(mk) || sugSet.get(mk).distance > dist) {
                  sugSet.set(mk, { key: idxKey, entity_type: m.entity_type, record_id: m.record_id, display: m.display, distance: dist });
                }
              }
            }
          }
        }
        fuzzy_suggestions = Array.from(sugSet.values())
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);
      }

      // Event details.
      const eventDetails = group.events.map(e => ({
        event_id: e.event_id,
        title: e.title,
        start_date: e.start_date,
        is_future: e.is_future,
      }));

      // Sort events: future first (by start_date asc), then past (by start_date desc).
      eventDetails.sort((a, b) => {
        if (a.is_future !== b.is_future) return a.is_future ? -1 : 1;
        const ad = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bd = b.start_date ? new Date(b.start_date).getTime() : 0;
        return a.is_future ? ad - bd : bd - ad;
      });

      const futureCount = eventDetails.filter(e => e.is_future).length;

      distinctNames.push({
        client_name: group.display,
        candidate_keys: group.candidates,
        event_count: group.events.length,
        future_event_count: futureCount,
        events: eventDetails,
        matches: allMatches,
        proposed_classification,
        fuzzy_suggestions,
      });
    }

    // Sort: unknown/ambiguous first (they need attention), then by event_count desc.
    const priorityOrder = { unknown: 0, ambiguous: 1, client: 2, partner: 3, brokerage: 4, lead: 5 };
    distinctNames.sort((a, b) => {
      const pa = priorityOrder[a.proposed_classification] ?? 9;
      const pb = priorityOrder[b.proposed_classification] ?? 9;
      if (pa !== pb) return pa - pb;
      return b.event_count - a.event_count;
    });

    // ── Summary stats ──
    const now = new Date();
    let futureTotal = 0, pastTotal = 0, noDateTotal = 0;
    for (const e of orphanEvents) {
      if (!e.start_date) { noDateTotal += 1; continue; }
      const d = new Date(e.start_date);
      if (isNaN(d.getTime())) { noDateTotal += 1; continue; }
      if (d >= now) futureTotal += 1; else pastTotal += 1;
    }

    const classificationCounts = {};
    for (const d of distinctNames) {
      classificationCounts[d.proposed_classification] = (classificationCounts[d.proposed_classification] || 0) + 1;
    }

    return Response.json({
      summary: {
        total_events: total,
        events_with_null_client_id: orphanCount,
        of_those_with_client_name: withNameCount,
        of_those_without_client_name: orphanCount - withNameCount,
        future_events_with_null_client_id: futureTotal,
        past_events_with_null_client_id: pastTotal,
        no_date_with_null_client_id: noDateTotal,
        distinct_client_names: distinctNames.length,
      },
      classification_counts: classificationCounts,
      entities_indexed: {
        clients: clients.length,
        referral_partners: partners.length,
        brokerages: brokerages.length,
        leads: leads.length,
        total_index_keys: allIndexKeys.length,
      },
      distinct_client_names: distinctNames,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});