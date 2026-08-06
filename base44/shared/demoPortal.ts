// ── Demo-portal containment helpers (shared by portal data functions) ──────
//
// Portal privacy work excludes is_demo rows everywhere so demo data never
// leaks into a real client's portal. But a SEEDED DEMO CLIENT'S OWN PORTAL
// must show its demo rows — otherwise the demo renders empty and the product
// can't be evaluated.
//
// Rule: resolve the portal's owning Client (or ReferralPartner for the broker
// path) first. If that owner is itself demo, DROP the is_demo exclusion for
// that request (demo rows flow through; projections, pseudonymization, min-N
// suppression stay identical). If the owner is NOT demo, behavior is
// unchanged (is_demo rows excluded).

/**
 * Returns true when demo rows should be EXCLUDED for this owner.
 * (i.e. the owner is a real client/partner → keep demo rows out.)
 */
export function shouldExcludeDemo(owner: { is_demo?: boolean } | null | undefined): boolean {
  return !(owner && owner.is_demo === true);
}

/**
 * Returns the is_demo filter fragment to spread into an entity filter.
 * When demo rows should be excluded → { is_demo: { $ne: true } }.
 * When the owner is demo (rows flow through) → {} (no exclusion).
 */
export function demoExclusion(excludeDemo: boolean): Record<string, unknown> {
  return excludeDemo ? { is_demo: { $ne: true } } : {};
}

/**
 * Filter an in-memory array by the same rule. Keeps non-demo rows always;
 * keeps demo rows only when the owner is demo.
 */
export function filterDemoRows<T extends { is_demo?: boolean }>(rows: T[], excludeDemo: boolean): T[] {
  if (!excludeDemo) return rows;
  return rows.filter(r => !r.is_demo);
}