/**
 * Proposal fulfillment — ONE place that answers "what's in this proposal,
 * and which of it is booked / delivered?"
 *
 * Everything here is DERIVED from the proposal's `selections` and the
 * CalendarEvents linked to it (proposal_id + service_id). Nothing is stored,
 * so it can never drift from the calendar.
 *
 * Used by: ProposalPicker (Book Service dialog), ProposalFulfillment card
 * (proposal editor + client detail), and the client-card delivery chip.
 */

import { productCatalog } from '@/components/curriculum/catalogData';
import { resolveStaticKeys } from '@/lib/catalogServiceResolver';

// The four service groups a proposal can carry, in display order.
// `dataKey` holds enriched objects ({ id, name, price, ... }); `idKey` is the
// older bare-id fallback. Both shapes exist on live records.
export const SELECTION_GROUPS = [
  { dataKey: 'workshopsData',         idKey: 'workshops',         category: 'workshop',   label: 'Workshop',   catalogGroup: 'workshops' },
  { dataKey: 'challengeProgramsData', idKey: 'challengePrograms', category: 'challenge',  label: 'Challenge',  catalogGroup: 'challenges' },
  { dataKey: 'leadershipData',        idKey: 'leadership',        category: 'leadership', label: 'Leadership', catalogGroup: 'leadership' },
  { dataKey: 'movementClassesData',   idKey: 'movementClasses',   category: 'class',      label: 'Class',      catalogGroup: 'movementClasses' },
];

/**
 * Older proposals (Curriculum Designer, pre-2026) stored STATIC catalog keys
 * ("positiveMinds") instead of live Service IDs. Resolve one of those to
 * { name, service } so the line reads properly and can book against the live
 * service when a name match exists.
 */
function resolveLegacyKey(key, group, services) {
  const entry = productCatalog?.[group.catalogGroup]?.[key];
  if (!entry) return null;
  const [liveId] = resolveStaticKeys([key], group.category, services);
  const service = liveId ? services.find(s => s.id === liveId) : null;
  return { name: entry.name, service };
}

/** Proposal statuses that still have something left to book/deliver. */
export const OPEN_PROPOSAL_STATUSES = ['sent', 'viewed', 'accepted'];

/**
 * Flatten a proposal's selections into bookable service items.
 * Wellness boxes are intentionally excluded — they ship, they aren't scheduled.
 */
export function getProposalServiceItems(proposal, services = []) {
  const sel = proposal?.selections;
  if (!sel) return [];
  const byId = {};
  for (const s of services) byId[s.id] = s;
  const items = [];
  const seen = new Set();

  for (const g of SELECTION_GROUPS) {
    const enriched = Array.isArray(sel[g.dataKey]) ? sel[g.dataKey] : [];
    const bare = Array.isArray(sel[g.idKey]) ? sel[g.idKey] : [];
    if (enriched.length > 0) {
      for (const svc of enriched) {
        const serviceId = svc?.id || svc?.service_id || '';
        const key = serviceId || `${g.category}:${svc?.name || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const db = serviceId ? byId[serviceId] : null;
        items.push({
          key,
          service_id: serviceId,
          name: svc?.name || db?.name || 'Unknown service',
          category: g.category,
          label: g.label,
          price: Number(svc?.price ?? db?.price ?? 0) || 0,
          description: svc?.description || db?.description || '',
          rawId: serviceId && !db ? serviceId : null,
        });
      }
    } else {
      for (const id of bare) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        let db = byId[id];
        let legacy = null;
        if (!db) {
          legacy = resolveLegacyKey(id, g, services);
          if (legacy?.service) db = legacy.service;
        }
        items.push({
          key: id,
          // Book against the live service when the legacy key resolved to one
          service_id: db?.id || id,
          name: db?.name || legacy?.name || 'Unknown service',
          category: g.category,
          label: g.label,
          price: Number(db?.price ?? 0) || 0,
          description: db?.description || '',
          rawId: db ? null : id,
          legacyKey: legacy ? id : null,
        });
      }
    }
  }
  return items;
}

/**
 * Events that belong to this proposal. Prefer an explicit proposal_id link;
 * fall back to client-level events that carry NO proposal_id (older bookings),
 * so an event booked against proposal B never claims a line in proposal A.
 */
export function getProposalEvents(proposal, events = []) {
  if (!proposal) return [];
  return events.filter(e =>
    e.proposal_id === proposal.id ||
    (!e.proposal_id && proposal.client_id && e.client_id === proposal.client_id)
  );
}

/**
 * Per-service booking status for a proposal.
 * Returns { items, total, booked, delivered, notBooked, allBooked, allDelivered }.
 * Each item gains: status ('not_booked' | 'booked' | 'delivered'), event, eventDate.
 * "Booked" = a linked CalendarEvent exists; "Delivered" = that event is marked completed.
 */
export function computeProposalFulfillment(proposal, events = [], services = []) {
  const items = getProposalServiceItems(proposal, services);
  const linked = getProposalEvents(proposal, events);

  const enriched = items.map(item => {
    const matches = item.service_id ? linked.filter(e => e.service_id === item.service_id) : [];
    // Delivered beats booked; among booked, show the soonest upcoming (or latest past)
    const delivered = matches.find(e => e.completed);
    let ev = delivered || null;
    if (!ev && matches.length > 0) {
      const now = Date.now();
      const upcoming = matches.filter(e => new Date(e.start_date).getTime() >= now)
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      const past = matches.filter(e => new Date(e.start_date).getTime() < now)
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
      ev = upcoming[0] || past[0] || null;
    }
    const status = delivered ? 'delivered' : (ev ? 'booked' : 'not_booked');
    return { ...item, status, event: ev, eventDate: ev?.start_date || null };
  });

  const total = enriched.length;
  const delivered = enriched.filter(i => i.status === 'delivered').length;
  const bookedOnly = enriched.filter(i => i.status === 'booked').length;
  const booked = delivered + bookedOnly; // booked includes delivered
  return {
    items: enriched,
    total,
    booked,
    bookedOnly,
    delivered,
    notBooked: total - booked,
    allBooked: total > 0 && booked === total,
    allDelivered: total > 0 && delivered === total,
  };
}

/** Company / contact for display — Client record wins, proposal text is the fallback. */
export function getProposalParty(proposal, clients = []) {
  const client = proposal?.client_id ? clients.find(c => c.id === proposal.client_id) : null;
  const company = client?.company || proposal?.company || '';
  const contact = client?.name || proposal?.client_name || '';
  // Older records put the company in client_name — don't print it twice.
  const contactShown = contact && contact !== company ? contact : '';
  return { client, company: company || contact || 'Unnamed', contact: contactShown, email: client?.email || proposal?.client_email || '' };
}

/** Short "1/3 delivered · 2 booked" summary string. */
export function fulfillmentSummary(f) {
  if (!f || f.total === 0) return '';
  const parts = [`${f.delivered}/${f.total} delivered`];
  if (f.bookedOnly > 0) parts.push(`${f.bookedOnly} booked`);
  return parts.join(' · ');
}
