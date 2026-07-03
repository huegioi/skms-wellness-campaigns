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