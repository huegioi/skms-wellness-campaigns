// ── Demo / internal containment helpers (frontend) ─────────────────────────
//
// Mirrors the backend shared/demoPortal.ts + demoClient.ts rules:
//   • is_demo rows are excluded from all real business stats.
//   • is_internal clients (SkillfulMeans test client) are excluded from
//     financials, briefings, follow-up queue, services-to-schedule, and
//     open-clients — but their events stay visible in Scheduling Hub.
//   • A demo client's OWN portal shows its demo rows (handled backend-side).

/** Set of client IDs where is_internal === true. */
export function internalClientIdSet(clients = []) {
  const s = new Set();
  for (const c of clients) {
    if (c && c.is_internal === true) s.add(c.id);
  }
  return s;
}

/** True if the client record is internal (SkillfulMeans test client). */
export function isInternalClient(client) {
  return !!(client && client.is_internal === true);
}

/**
 * Filter invoices to real-business only: drop is_demo, out_of_scope, and
 * invoices whose client_id belongs to an internal client.
 */
export function filterRealInvoices(invoices = [], internalIds = new Set()) {
  return invoices.filter(i => !i.is_demo && !i.out_of_scope && !internalIds.has(i.client_id));
}

/**
 * Filter proposals to real-business only: drop is_demo and proposals whose
 * client_id belongs to an internal client.
 */
export function filterRealProposals(proposals = [], internalIds = new Set()) {
  return proposals.filter(p => !p.is_demo && !internalIds.has(p.client_id));
}

/**
 * Dashboard / follow-up / services-to-schedule client list: exclude demo,
 * internal, and (optionally) assessment-lead clients.
 */
export function filterRealClients(clients = [], { excludeAssessmentLeads = true } = {}) {
  return clients.filter(c => !c.is_demo && !c.is_internal && (excludeAssessmentLeads ? !c.is_assessment_lead : true));
}

/** Events: hide is_demo unless the user toggled "Show demo" on. */
export function filterVisibleEvents(events = [], showDemo) {
  if (showDemo) return events;
  return events.filter(e => !e.is_demo);
}