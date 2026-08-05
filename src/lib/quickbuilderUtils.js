/**
 * Shared helpers for Quick Builder inquiry surfacing.
 * Used by the dashboard card, the Leads banner/list, (not the Deno briefing
 * functions — those inline the same logic since they can't import src/).
 */

export function parseQuickBuilderGoals(notes) {
  if (!notes) return [];
  const m = String(notes).match(/Goals:\s*([^\n]*)/);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}

export function parseWellnessBoxesPreference(notes) {
  if (!notes) return null;
  const m = String(notes).match(/Wellness boxes:\s*(yes|no)/i);
  if (!m) return null;
  return m[1].toLowerCase() === 'yes';
}

export function timeSince(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * A "new" Quick Builder inquiry = submitted via the public Quick Builder
 * (source starts with "Quick Builder"), still cold, and no interaction logged.
 */
export function isNewQuickBuilderInquiry(l) {
  return !!l &&
    (l.source || '').startsWith('Quick Builder') &&
    (l.status || 'cold') === 'cold' &&
    !l.last_contacted_date;
}

/**
 * Parse "Composite: NN/100 · Projected annual savings: $X" from Mental Fitness
 * Score / Journey lead notes. Returns { score, savings } or null when the
 * pattern is absent or unparseable.
 */
export function parseCompositeAndSavings(notes) {
  if (!notes) return null;
  const m = String(notes).match(/Composite:\s*(\d+)\s*\/\s*100\s*·\s*Projected annual savings:\s*\$?([\d,]+)/i);
  if (!m) return null;
  const score = parseInt(m[1], 10);
  const savings = parseInt(m[2].replace(/,/g, ''), 10);
  if (isNaN(score) || isNaN(savings)) return null;
  return { score, savings };
}

/**
 * Lowercased domain of an email address, or '' if not parseable.
 * Used as a display fallback for leads missing a company name.
 */
export function emailDomainOf(email) {
  if (!email) return '';
  const at = email.indexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}