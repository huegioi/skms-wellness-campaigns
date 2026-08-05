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