import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEAM_EMAILS = (Deno.env.get("TEAM_EMAILS") || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
const isTeamMember = (user) => user && (user.role === 'admin' || TEAM_EMAILS.includes((user.email || "").toLowerCase()));

// ── Normalization helpers ──

const CREDENTIAL_SUFFIXES = new Set([
  'ms', 'm.s.', 'rd', 'r.d.', 'cdn', 'mba', 'phd', 'ph.d.', 'lcsw', 'lmsw',
  'rn', 'np', 'pa', 'md', 'do', 'ncc', 'cce', 'chwc', 'acsm-cep', 'rdn',
  'ldn', 'cscs', 'ces', 'rph', 'dtr', 'cde', 'bcba', 'lcpc', 'lmft', 'psy.d.',
  'edd', 'm.ed.', 'ma', 'm.a.', 'bs', 'b.s.', 'msw', 'm.s.w.', 'ld',
]);

function normalizeKey(raw) {
  if (!raw) return { key: '', parenContent: '' };
  let s = String(raw).toLowerCase().trim();
  const parenMatch = s.match(/\(([^)]+)\)/);
  const parenContent = parenMatch ? parenMatch[1].trim() : '';
  s = s.replace(/\([^)]*\)/g, ' ');
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const kept = parts.filter(p => !CREDENTIAL_SUFFIXES.has(p.toLowerCase().replace(/\./g, '')));
    s = kept.length > 0 ? kept.join(' ') : parts[0];
  }
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

// Check if two keys are a normalized match (spaces-removed equality or prefix with ≥6 chars).
function normalizedMatchType(candKey, idxKey) {
  if (!candKey || !idxKey || candKey === idxKey) return null;
  // Spaces-removed equality.
  const candNoSpaces = candKey.replace(/\s/g, '');
  const idxNoSpaces = idxKey.replace(/\s/g, '');
  if (candNoSpaces && idxNoSpaces && candNoSpaces === idxNoSpaces) return 'spaces_removed';
  // Prefix match with ≥6 chars in common.
  const shorter = candKey.length <= idxKey.length ? candKey : idxKey;
  const longer = candKey.length <= idxKey.length ? idxKey : candKey;
  if (shorter.length >= 6 && longer.startsWith(shorter)) return 'prefix';
  return null;
}

// Entity priority: lower = higher priority.
const ENTITY_PRIORITY = { client: 1, partner: 2, brokerage: 3, lead: 4 };
const DELIVERY_TYPES = new Set(['workshop', 'challenge', 'leadership', 'class', 'delivery', 'presentation']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isTeamMember(user)) return Response.json({ error: 'Forbidden — team members only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { classification: classificationFilter, offset: rawOffset, limit: rawLimit, compact, include_unnamed } = body;
    const offset = Math.max(0, parseInt(rawOffset) || 0);
    const limit = Math.max(1, parseInt(rawLimit) || 2);
    const isCompact = !!compact;

    // ── Fetch all entities (read-only, high limits) ──
    const [events, clients, partners, brokerages, leads, proposals, invoices] = await Promise.all([
      base44.asServiceRole.entities.CalendarEvent.list('-created_date', 2000),
      base44.asServiceRole.entities.Client.list('-created_date', 2000),
      base44.asServiceRole.entities.ReferralPartner.list('-created_date', 2000),
      base44.asServiceRole.entities.Brokerage.list('-created_date', 500),
      base44.asServiceRole.entities.Lead.list('-created_date', 2000),
      base44.asServiceRole.entities.Proposal.list('-created_date', 2000),
      base44.asServiceRole.entities.Invoice.list('-created_date', 2000),
    ]);

    // ── Build lookup index: normalizedKey → [{ entity_type, record_id, display, last_contacted_date }] ──
    const index = new Map();

    function addToIndex(rawName, rawCompany, entityType, recordId, display, lastContacted) {
      for (const raw of [rawName, rawCompany]) {
        if (!raw || !String(raw).trim()) continue;
        const { key, parenContent } = normalizeKey(raw);
        if (!key) continue;
        const entry = { entity_type: entityType, record_id: recordId, display: display || String(raw).trim(), last_contacted_date: lastContacted || null };
        for (const k of [key, parenContent]) {
          if (!k) continue;
          const list = index.get(k) || [];
          if (!list.some(m => m.record_id === recordId && m.entity_type === entityType)) list.push(entry);
          index.set(k, list);
        }
      }
    }

    for (const c of clients) addToIndex(c.name, c.company, 'client', c.id, c.name || c.company, c.last_contacted_date || c.last_contacted);
    for (const p of partners) addToIndex(p.name, p.company, 'partner', p.id, p.name || p.company, p.last_contacted_date);
    for (const b of brokerages) addToIndex(b.name, b.company, 'brokerage', b.id, b.name || b.company, null);
    for (const l of leads) addToIndex(l.name, l.company, 'lead', l.id, l.name || l.company, l.last_contacted_date);

    const allIndexKeys = Array.from(index.keys());

    // ── Build proposal/invoice lookup by normalized client_name/company ──
    function normalizeForLookup(raw) {
      if (!raw) return '';
      return normalizeKey(raw).key;
    }

    const proposalKeys = proposals.map(p => ({
      keys: [normalizeForLookup(p.client_name), normalizeForLookup(p.company)].filter(Boolean),
    }));
    const invoiceKeys = invoices.map(inv => ({
      keys: [normalizeForLookup(inv.client_name), normalizeForLookup(inv.company)].filter(Boolean),
    }));

    // ── Orphan events ──
    const total = events.length;
    const orphanEvents = events.filter(e => !e.client_id);
    const orphanCount = orphanEvents.length;
    const withName = orphanEvents.filter(e => e.client_name && String(e.client_name).trim());
    const withNameCount = withName.length;
    const withoutName = orphanEvents.filter(e => !e.client_name || !String(e.client_name).trim());

    // ── Itemize orphans without a name ──
    const orphans_without_name = withoutName.map(e => ({
      event_id: e.id,
      title: e.title,
      start_date: e.start_date,
      is_future: e.start_date ? new Date(e.start_date) >= new Date() : false,
      event_type: e.event_type,
      presenter: e.presenter || e.presenter_email || null,
      service_id: e.service_id || null,
      proposal_id: e.proposal_id || null,
      location: e.location || null,
    }));

    // ── Group orphan events by normalized primary key ──
    const groupMap = new Map();
    for (const e of withName) {
      const display = String(e.client_name).trim();
      const { key: primaryKey, parenContent } = normalizeKey(display);
      const candidates = [primaryKey];
      if (parenContent) candidates.push(parenContent);
      const rawLower = display.toLowerCase().trim();
      if (rawLower && !candidates.includes(rawLower)) candidates.push(rawLower);

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
        event_type: e.event_type,
        presenter: e.presenter || e.presenter_email || null,
      });
    }

    // ── Process each group: compute matches (exact, normalized, fuzzy) across ALL sources ──
    const distinctNames = [];
    for (const group of groupMap.values()) {
      // Collect all matches, deduped by entity_type:record_id.
      const matchMap = new Map(); // `${type}:${id}` -> { entity_type, record_id, display, match_type, detail, distance, last_contacted_date }

      for (const candKey of group.candidates) {
        if (!candKey || candKey.length < 2) continue;

        for (const idxKey of allIndexKeys) {
          if (!idxKey || idxKey.length < 2) continue;
          const idxEntries = index.get(idxKey) || [];

          // 1. Exact match.
          if (candKey === idxKey) {
            for (const m of idxEntries) {
              const mk = `${m.entity_type}:${m.record_id}`;
              const existing = matchMap.get(mk);
              if (!existing || existing.match_type !== 'exact') {
                matchMap.set(mk, { ...m, match_type: 'exact', detail: null, distance: 0 });
              }
            }
            continue; // exact is the strongest — skip normalized/fuzzy for this pair
          }

          // 2. Normalized match.
          const normType = normalizedMatchType(candKey, idxKey);
          if (normType) {
            for (const m of idxEntries) {
              const mk = `${m.entity_type}:${m.record_id}`;
              const existing = matchMap.get(mk);
              if (!existing || (existing.match_type === 'fuzzy_suggestion')) {
                matchMap.set(mk, { ...m, match_type: 'normalized_match', detail: normType, distance: 0 });
              }
            }
            continue;
          }

          // 3. Fuzzy match (edit distance ≤ 2, > 0).
          if (Math.abs(candKey.length - idxKey.length) > 2) continue;
          const dist = levenshtein(candKey, idxKey);
          if (dist > 0 && dist <= 2) {
            for (const m of idxEntries) {
              const mk = `${m.entity_type}:${m.record_id}`;
              const existing = matchMap.get(mk);
              if (!existing) {
                matchMap.set(mk, { ...m, match_type: 'fuzzy_suggestion', detail: null, distance: dist });
              } else if (existing.match_type === 'fuzzy_suggestion' && existing.distance > dist) {
                matchMap.set(mk, { ...m, match_type: 'fuzzy_suggestion', detail: null, distance: dist });
              }
            }
          }
        }
      }

      // ── Rank matches: exact first, then normalized, then fuzzy. Within tier, by entity priority. ──
      const tierRank = { exact: 0, normalized_match: 1, fuzzy_suggestion: 2 };
      const allMatches = Array.from(matchMap.values()).sort((a, b) => {
        if (a.match_type !== b.match_type) return tierRank[a.match_type] - tierRank[b.match_type];
        const pa = ENTITY_PRIORITY[a.entity_type] || 99;
        const pb = ENTITY_PRIORITY[b.entity_type] || 99;
        if (pa !== pb) return pa - pb;
        return (a.distance || 0) - (b.distance || 0);
      });

      // ── Classify by priority: Client > Partner > Brokerage > Lead ──
      // First entity type (in priority order) with ANY match wins.
      // At the winning type: best-tier matches determine the label.
      // Ambiguous if multiple records at the same (winning) tier+type.
      let proposed_classification = 'unknown';
      const matchesByType = {}; // entity_type -> { best_tier, records: [] }
      for (const m of allMatches) {
        if (!matchesByType[m.entity_type]) matchesByType[m.entity_type] = { best_tier: m.match_type, records: [] };
        const tier = tierRank[m.match_type];
        const currentBest = tierRank[matchesByType[m.entity_type].best_tier];
        if (tier < currentBest) {
          matchesByType[m.entity_type] = { best_tier: m.match_type, records: [m] };
        } else if (tier === currentBest) {
          matchesByType[m.entity_type].records.push(m);
        }
      }

      const priorityTypes = ['client', 'partner', 'brokerage', 'lead'];
      for (const type of priorityTypes) {
        const info = matchesByType[type];
        if (!info) continue;
        const isFuzzy = info.best_tier !== 'exact';
        const suffix = isFuzzy ? '_fuzzy' : '';
        if (info.records.length > 1) {
          proposed_classification = 'ambiguous';
        } else {
          proposed_classification = `${type}${suffix}`;
        }
        break; // first priority type with matches wins
      }

      // ── Relationship signals ──
      const bestMatch = allMatches[0] || null;
      const last_contacted_date = bestMatch?.last_contacted_date || null;

      // Count proposals/invoices matching any candidate key.
      const candSet = new Set(group.candidates.filter(Boolean));
      let proposal_count = 0;
      for (const p of proposalKeys) {
        if (p.keys.some(k => candSet.has(k))) proposal_count++;
      }
      let invoice_count = 0;
      for (const inv of invoiceKeys) {
        if (inv.keys.some(k => candSet.has(k))) invoice_count++;
      }

      // Earliest / latest event dates.
      const dates = group.events.map(e => e.start_date ? new Date(e.start_date) : null).filter(Boolean);
      const earliest_event_date = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString() : null;
      const latest_event_date = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString() : null;

      // Event activity (event_type + presenter per event).
      const event_activity = group.events.map(e => ({
        event_id: e.event_id,
        event_type: e.event_type,
        presenter: e.presenter,
      }));

      // looks_like_delivery: any event with a delivery-type event_type.
      const looks_like_delivery = group.events.some(e => DELIVERY_TYPES.has(e.event_type));

      // ── Build event list (sorted: future first, then past desc) ──
      const eventDetails = group.events.map(e => ({
        event_id: e.event_id,
        title: e.title,
        start_date: e.start_date,
        is_future: e.is_future,
        event_type: e.event_type,
        presenter: e.presenter,
      }));
      eventDetails.sort((a, b) => {
        if (a.is_future !== b.is_future) return a.is_future ? -1 : 1;
        const ad = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bd = b.start_date ? new Date(b.start_date).getTime() : 0;
        return a.is_future ? ad - bd : bd - ad;
      });

      const futureCount = group.events.filter(e => e.is_future).length;

      distinctNames.push({
        client_name: group.display,
        candidate_keys: group.candidates,
        event_count: group.events.length,
        future_event_count: futureCount,
        events: eventDetails,
        matches: allMatches.map(m => ({
          entity_type: m.entity_type,
          record_id: m.record_id,
          display: m.display,
          match_type: m.match_type,
          detail: m.detail,
          distance: m.distance,
        })),
        proposed_classification,
        relationship_signals: {
          last_contacted_date,
          proposal_count,
          invoice_count,
          earliest_event_date,
          latest_event_date,
          event_activity,
          looks_like_delivery,
        },
      });
    }

    // ── Sort: unknown/ambiguous first, then by event_count desc ──
    const priorityOrder = { unknown: 0, ambiguous: 1, client: 2, client_fuzzy: 3, partner: 4, partner_fuzzy: 5, brokerage: 6, brokerage_fuzzy: 7, lead: 8, lead_fuzzy: 9 };
    distinctNames.sort((a, b) => {
      const pa = priorityOrder[a.proposed_classification] ?? 99;
      const pb = priorityOrder[b.proposed_classification] ?? 99;
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

    // ── Compact mode: flat single-line strings, all groups, no paging ──
    if (isCompact) {
      let compactGroups = distinctNames;
      if (classificationFilter) {
        compactGroups = distinctNames.filter(d => d.proposed_classification === classificationFilter);
      }
      const compactLines = compactGroups.map(g => {
        const best = g.matches[0] || {};
        const bestStr = best.entity_type
          ? `${best.entity_type}/${best.match_type}/${best.display || '—'}/${best.record_id || '—'}`
          : 'none';
        const delivery = g.relationship_signals.looks_like_delivery;
        const props = g.relationship_signals.proposal_count;
        const inv = g.relationship_signals.invoice_count;
        const earliest = g.relationship_signals.earliest_event_date
          ? g.relationship_signals.earliest_event_date.slice(0, 10)
          : '—';
        const latest = g.relationship_signals.latest_event_date
          ? g.relationship_signals.latest_event_date.slice(0, 10)
          : '—';
        const lastContact = g.relationship_signals.last_contacted_date
          ? g.relationship_signals.last_contacted_date.slice(0, 10)
          : 'none';
        return `${g.client_name} | events:${g.event_count} future:${g.future_event_count} | ${g.proposed_classification} | best:${bestStr} | delivery:${delivery} | props:${props} inv:${inv} | ${earliest} → ${latest} | last_contact:${lastContact}`;
      });

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
        compact: true,
        groups: compactLines,
      });
    }

    // ── Non-compact mode: paged nested objects ──
    let filtered = distinctNames;
    if (classificationFilter) {
      filtered = distinctNames.filter(d => d.proposed_classification === classificationFilter);
    }
    const totalGroups = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    const has_more = offset + limit < totalGroups;

    const response = {
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
        proposals: proposals.length,
        invoices: invoices.length,
        total_index_keys: allIndexKeys.length,
      },
      paging: {
        classification_filter: classificationFilter || null,
        offset,
        limit,
        total_groups: totalGroups,
        has_more,
      },
      distinct_client_names: paged,
    };

    // Only include orphans_without_name when explicitly requested.
    if (include_unnamed) {
      response.orphans_without_name = orphans_without_name;
    }

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});