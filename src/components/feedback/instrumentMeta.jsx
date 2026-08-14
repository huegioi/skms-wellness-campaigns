// Instrument metadata + generalized matching/stats helpers.
// Reused by Who5Analytics (admin) and Who5ResultsPanel (client portal).

export const INSTRUMENT_META = {
  who5: {
    label: 'WHO-5 Wellbeing',
    scale: '0–100 · higher is better',
    interpretation: 'A validated 5-question wellbeing score. Higher means better overall wellbeing.',
    directionOfGood: 'higher',
  },
  uwes3: {
    label: 'UWES-3 Work Engagement',
    scale: '0–6 · higher is better',
    interpretation: 'Three-item work engagement scale — the score is the MEAN of the three 0–6 items, so it ranges 0–6. Higher means more energy, enthusiasm, and immersion at work.',
    directionOfGood: 'higher',
  },
  pss4: {
    label: 'PSS-4 Perceived Stress',
    scale: '0–16 · lower is better',
    interpretation: 'A 4-item perceived stress scale. Lower means less stress.',
    directionOfGood: 'lower',
  },
  ucla3: {
    label: 'UCLA-3 Loneliness',
    scale: '3–9 · lower is better',
    interpretation: 'A 3-item loneliness scale. Lower means less loneliness.',
    directionOfGood: 'lower',
  },
  cbi: {
    label: 'CBI Burnout',
    scale: '0–100 · lower is better',
    interpretation: 'A 6-item burnout scale using the standard CBI 0–100 scoring (each 0–4 item rescaled ×25 and averaged). Lower means less burnout.',
    directionOfGood: 'lower',
  },
  enps: {
    label: 'eNPS Advocacy',
    scale: '0–10 · higher is better',
    interpretation: 'Likelihood to recommend the program. Higher means stronger advocacy.',
    directionOfGood: 'higher',
  },
};

// ── Plain-language narration of a pre/post change ───────────────────────────
// Turns the numbers on an instrument card into a sentence a non-clinical HR
// reader can act on. Deliberately descriptive, never causal: we say "this group
// reported", not "the program improved", because these are uncontrolled or
// matched pre/post comparisons with no control group. The section subtitle and
// the "How we measured this" block carry the study-design caveat, so the
// narration stays about what the numbers say.
//
// `meaningful` / `modest` are absolute point thresholds on each instrument's
// own scale, drawn from commonly cited change bands (e.g. ~10 points on the
// 0–100 WHO-5). Below `modest`, the honest read is "essentially unchanged" —
// small movements on small samples are noise, and dressing them up as wins is
// how a wellbeing dashboard loses an HR team's trust.
const CHANGE_NARRATION = {
  who5: {
    noun: 'wellbeing',
    meaningful: 10, modest: 5,
    better: 'People rated their day-to-day mood, energy, and rest higher than they did at the start.',
    worse: 'People rated their day-to-day mood, energy, and rest lower than they did at the start.',
  },
  uwes3: {
    noun: 'work engagement',
    meaningful: 0.5, modest: 0.25,
    better: 'People reported more energy and enthusiasm for their work.',
    worse: 'People reported less energy and enthusiasm for their work.',
  },
  pss4: {
    noun: 'perceived stress',
    meaningful: 2, modest: 1,
    better: 'People felt less overwhelmed by day-to-day demands.',
    worse: 'People felt more overwhelmed by day-to-day demands.',
  },
  ucla3: {
    noun: 'loneliness',
    meaningful: 1, modest: 0.5,
    better: 'People felt more connected to the people around them.',
    worse: 'People felt less connected to the people around them.',
  },
  cbi: {
    noun: 'burnout',
    meaningful: 10, modest: 5,
    better: 'People reported feeling less exhausted and depleted by work.',
    worse: 'People reported feeling more exhausted and depleted by work.',
  },
  enps: {
    noun: 'advocacy',
    meaningful: 1, modest: 0.5,
    better: 'People became more likely to recommend the program to a colleague.',
    worse: 'People became less likely to recommend the program to a colleague.',
  },
};

/**
 * Build a plain-language sentence describing an instrument's pre/post change.
 * Returns null when the instrument or stats are unknown, so callers can simply
 * skip rendering rather than branch.
 *
 * @param {string} key   instrument key (who5, pss4, ...)
 * @param {object} stats { avgStart, avgEnd, avgDelta, isGood }
 * @param {object} opts  { startLabel, endLabel } to name the two time points
 */
export function describeChange(key, stats, opts = {}) {
  const n = CHANGE_NARRATION[key];
  const meta = INSTRUMENT_META[key];
  if (!n || !meta || !stats) return null;
  if (stats.avgStart == null || stats.avgEnd == null || stats.avgDelta == null) return null;

  // Parenthesised rather than "at ${label}" so any caller's wording reads as
  // English — "8.9 (Before)", "59.5 (1 Month After)", "51.5 (Day 0)" all work,
  // where "8.9 at before" does not.
  const startLabel = opts.startLabel || 'Before';
  const endLabel = opts.endLabel || 'After';
  const size = Math.abs(stats.avgDelta);
  const from = `${stats.avgStart.toFixed(1)} (${startLabel}) to ${stats.avgEnd.toFixed(1)} (${endLabel})`;

  // Too small to call in either direction.
  if (size < n.modest) {
    return `Average ${n.noun} was essentially unchanged — ${from}. A movement this small is within normal fluctuation and shouldn't be read as a result either way.`;
  }

  const magnitude = size >= n.meaningful ? 'a meaningful' : 'a modest';
  // isGood already accounts for instruments where lower is better, so a PSS-4
  // drop reads as an improvement rather than a decline.
  const direction = stats.isGood ? 'improvement' : 'decline';
  const movement = stats.avgDelta > 0 ? 'rose' : 'fell';
  const meaning = stats.isGood ? n.better : n.worse;

  return `Average ${n.noun} ${movement} from ${from} — ${magnitude} ${direction}. ${meaning}`;
}

// Resolve the composite score for a row, with legacy WHO-5 fallback.
export function getScore(row) {
  if (row.instrument_total != null) return row.instrument_total;
  if (row.who5_total != null) return row.who5_total;
  return null;
}

// Resolve the instrument key for a row, with legacy WHO-5 fallback.
export function getInstrumentKey(row) {
  return row.instrument || 'who5';
}

// Generalized matched-pair logic — year-aware, multi-end-type.
// Groups rows by (email, cohort_year) so pairs never cross plan years.
// Within each group: start = EARLIEST by submitted_at, end = LATEST by submitted_at.
// endTypes accepts a string OR an array of strings (normalized internally).
export function matchPairs(rows, startType, endTypes) {
  const endSet = Array.isArray(endTypes) ? new Set(endTypes) : new Set([endTypes]);
  const groups = {};
  for (const r of rows) {
    const email = (r.participant_email || '').toLowerCase().trim();
    if (!email) continue;
    const year = r.cohort_year || (r.submitted_at ? new Date(r.submitted_at).getFullYear() : null);
    if (year == null) continue;
    const gk = `${email}|${year}`;
    if (!groups[gk]) groups[gk] = { email, starts: [], ends: [] };
    if (r.survey_type === startType) groups[gk].starts.push(r);
    if (endSet.has(r.survey_type)) groups[gk].ends.push(r);
  }
  const distinctStartEmails = new Set();
  const pairs = [];
  for (const gk of Object.keys(groups)) {
    const g = groups[gk];
    if (!g.starts.length) continue;
    distinctStartEmails.add(g.email);
    if (!g.ends.length) continue;
    // start = earliest submission, end = latest submission
    g.starts.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    g.ends.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const startRow = g.starts[0];
    const endRow = g.ends[g.ends.length - 1];
    const startScore = getScore(startRow);
    const endScore = getScore(endRow);
    if (startScore != null && endScore != null) {
      pairs.push({ email: g.email, start: startScore, end: endScore });
    }
  }
  return { pairs, distinctStarts: distinctStartEmails.size };
}

// Baseline-only stats: average of each person's EARLIEST start-type response,
// grouped by (email, cohort_year) exactly like matchPairs so the two views
// count the same people. Used when a cohort has baseline data but no end-type
// responses yet — the portal shows the Before picture immediately instead of
// hiding everything until the follow-up survey exists.
export function calcBaseline(rows, startType) {
  const groups = {};
  for (const r of rows) {
    if (r.survey_type !== startType) continue;
    const email = (r.participant_email || '').toLowerCase().trim();
    if (!email) continue;
    const year = r.cohort_year || (r.submitted_at ? new Date(r.submitted_at).getFullYear() : null);
    if (year == null) continue;
    const gk = `${email}|${year}`;
    if (!groups[gk] || new Date(r.submitted_at) < new Date(groups[gk].submitted_at)) groups[gk] = r;
  }
  const scores = Object.values(groups).map(getScore).filter(s => s != null);
  if (!scores.length) return null;
  const avgStart = scores.reduce((s, v) => s + v, 0) / scores.length;
  return { baselineOnly: true, n: scores.length, avgStart };
}

// Generalized stats with direction-of-good awareness.
// For "lower is better" instruments, a negative delta is good (green).
export function calcStats(pairs, distinctStarts, directionOfGood = 'higher') {
  if (!pairs.length) return null;
  const n = pairs.length;
  const avgStart = pairs.reduce((s, p) => s + p.start, 0) / n;
  const avgEnd   = pairs.reduce((s, p) => s + p.end,   0) / n;
  const avgDelta = avgEnd - avgStart;
  const completion = distinctStarts > 0 ? Math.round((n / distinctStarts) * 100) : 0;
  const isGood = directionOfGood === 'higher' ? avgDelta >= 0 : avgDelta <= 0;
  return { n, avgStart, avgEnd, avgDelta, completion, isGood };
}

// Normalization ranges for cross-instrument comparison.
// invert: true for "lower is better" instruments so "up" always reads as better.
export const NORM_RANGES = {
  who5:  { min: 0, max: 100, invert: false },
  uwes3: { min: 0, max: 6, invert: false },
  pss4:  { min: 0, max: 16, invert: true },
  ucla3: { min: 3, max: 9, invert: true },
  cbi:   { min: 0, max: 100, invert: true },
  enps:  { min: 0, max: 10, invert: false },
};

// Normalize a raw instrument score to 0–100, inverting worse-direction
// instruments so "up" always reads as better.
export function normalizeScore(score, instrumentKey) {
  const range = NORM_RANGES[instrumentKey];
  if (!range || score == null) return null;
  const pct = ((score - range.min) / (range.max - range.min)) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  return range.invert ? 100 - clamped : clamped;
}

// True eNPS: promoters (>=9) minus detractors (<=6), ÷ n, ×100.
// Single shared definition everywhere the label says "eNPS".
// Returns { enps, n, promoters, passives, detractors }; enps is null when n === 0.
export function computeEnps(scores) {
  const valid = (scores || []).filter(s => s != null && !isNaN(s));
  const n = valid.length;
  if (n === 0) return { enps: null, n: 0, promoters: 0, passives: 0, detractors: 0 };
  const promoters = valid.filter(s => s >= 9).length;
  const detractors = valid.filter(s => s <= 6).length;
  const passives = n - promoters - detractors;
  const enps = Math.round(((promoters - detractors) / n) * 100);
  return { enps, n, promoters, passives, detractors };
}