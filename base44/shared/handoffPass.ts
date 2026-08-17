/**
 * ══════════════════════════════════════════════════════════════════════════
 *  HANDOFF PASS — how the warming tools carry context to each other.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A visitor moves ROI calculator → Mental Fitness Journey → Claims Lite →
 * Quick Builder. Each hop must know what the previous one learned, WITHOUT
 * asking again and WITHOUT putting anything sensitive in a URL.
 *
 * The rule: a link carries only `?pass=<token>` and `?ref=<broker>`. Every
 * fact — headcount, salary, company, email — lives on the server against
 * that token. Nothing personal reaches browser history, server logs, or an
 * analytics referrer.
 *
 * One pass per visitor journey, appended to at each hop, so the whole trail
 * survives and warmth can be read off `source_chain`.
 */

/** Rungs, deepest last — the order defines warmth. */
export const RUNGS = ['roi_calc', 'journey', 'claims_lite', 'claims_full', 'quick_builder'] as const;
export type Rung = typeof RUNGS[number];

export const RUNG_LABELS: Record<string, string> = {
  roi_calc: 'ROI calculator',
  journey: 'Mental Fitness Journey',
  claims_lite: 'Claims quick read',
  claims_full: 'Full claims report',
  quick_builder: 'Quick Builder',
};

export interface HandoffPayload {
  headcount?: number | null;
  avg_salary?: number | null;
  industry?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  domain?: string | null;
  /** Free-form highlights the next screen can show back, e.g. the Journey gap. */
  highlights?: { label: string; value: string }[];
}

/** 30 days is long enough to finish a renewal conversation, short enough to expire. */
export const PASS_TTL_DAYS = 30;

/**
 * Opaque, unguessable token. Deliberately not the record id: ids are
 * sequential-ish and leak record counts.
 */
export function newPassToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function passExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + PASS_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isExpired(pass: { expires_at?: string | null } | null | undefined): boolean {
  if (!pass?.expires_at) return false;
  return new Date(pass.expires_at).getTime() < Date.now();
}

/** Adds a rung without duplicating it, preserving first-seen order. */
export function appendRung(chain: string[] | null | undefined, rung: string): string[] {
  const list = Array.isArray(chain) ? [...chain] : [];
  if (!list.includes(rung)) list.push(rung);
  return list;
}

/** The deepest rung reached — what the lead board's warmth chip reads. */
export function deepestRung(chain: string[] | null | undefined): string | null {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  let best: string | null = null;
  let bestIdx = -1;
  for (const r of chain) {
    const i = RUNGS.indexOf(r as Rung);
    if (i > bestIdx) { bestIdx = i; best = r; }
  }
  return best;
}

/**
 * Merge newly-learned facts into a payload. Later tools win on conflict,
 * but a blank never overwrites a known value — a visitor who skips a field
 * must not erase what an earlier tool already established.
 */
export function mergePayload(
  existing: HandoffPayload | null | undefined,
  incoming: HandoffPayload | null | undefined,
): HandoffPayload {
  const out: HandoffPayload = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (v === null || v === undefined || v === '') continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
