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
    scale: '0–18 · higher is better',
    interpretation: 'Three-item work engagement scale. Higher means more energy, enthusiasm, and immersion at work.',
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
    scale: '0–24 · lower is better',
    interpretation: 'A 6-item burnout scale. Lower means less burnout.',
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

// Generalized matched-pair logic — reuses the existing WHO-5 Day 0→Day 14
// matching approach, but works for any instrument via instrument_total.
export function matchPairs(rows, startType, endType) {
  const starts = {};
  const ends = {};
  for (const r of rows) {
    const email = (r.participant_email || '').toLowerCase().trim();
    if (!email) continue;
    if (r.survey_type === startType) starts[email] = r;
    if (r.survey_type === endType)   ends[email]   = r;
  }
  const pairs = [];
  for (const email of Object.keys(starts)) {
    if (ends[email]) {
      const startScore = getScore(starts[email]);
      const endScore = getScore(ends[email]);
      if (startScore != null && endScore != null) {
        pairs.push({ email, start: startScore, end: endScore });
      }
    }
  }
  return { pairs, distinctStarts: Object.keys(starts).length };
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
  uwes3: { min: 0, max: 18, invert: false },
  pss4:  { min: 0, max: 16, invert: true },
  ucla3: { min: 3, max: 9, invert: true },
  cbi:   { min: 0, max: 24, invert: true },
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