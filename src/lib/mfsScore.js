// Mental Fitness Score — instrument normalization + composite scoring.
// All scores normalized to 0–100 (higher = better).

// ── Per-instrument normalization (0–100, higher = better) ──

// WHO-5: raw sum (0–25) × 4 → 0–100
export function normalizeWho5(responses) {
  if (!responses) return null;
  const raw = (responses.q1 || 0) + (responses.q2 || 0) + (responses.q3 || 0) + (responses.q4 || 0) + (responses.q5 || 0);
  return raw * 4;
}

// PSS-4: (16 − raw) / 16 × 100 — inverted (higher raw = more stress = worse)
export function normalizePss4(responses) {
  if (!responses) return null;
  const raw = (responses.q1 || 0) + (responses.q2 || 0) + (responses.q3 || 0) + (responses.q4 || 0);
  return ((16 - raw) / 16) * 100;
}

// UWES-3: mean(0–6) / 6 × 100
export function normalizeUwes3(responses) {
  if (!responses) return null;
  const mean = ((responses.q1 || 0) + (responses.q2 || 0) + (responses.q3 || 0)) / 3;
  return (mean / 6) * 100;
}

// UCLA-3: (9 − raw) / 6 × 100 — inverted (higher raw = more loneliness = worse)
export function normalizeUcla3(responses) {
  if (!responses) return null;
  const raw = (responses.q1 || 0) + (responses.q2 || 0) + (responses.q3 || 0);
  return ((9 - raw) / 6) * 100;
}

// Normalize a single instrument's responses by key
export function normalizeInstrument(instrumentKey, responses) {
  switch (instrumentKey) {
    case 'who5':  return normalizeWho5(responses);
    case 'pss4':  return normalizePss4(responses);
    case 'uwes3': return normalizeUwes3(responses);
    case 'ucla3': return normalizeUcla3(responses);
    default: return null;
  }
}

// ── Composite ──
// composite = mean of per-response composites
// (each respondent's composite = mean of their available instrument scores)
export function computeComposite(perRespondentComposites) {
  const valid = perRespondentComposites.filter(s => s != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ── Instrument display metadata ──
export const MFS_INSTRUMENTS = [
  { key: 'who5',  label: 'Wellbeing',  color: '#013f7c' },
  { key: 'pss4',  label: 'Stress',     color: '#770142' },
  { key: 'uwes3', label: 'Engagement', color: '#264d44' },
  { key: 'ucla3', label: 'Connection', color: '#b8860b' },
];

// ── Score zones (Low / Typical / High) ──
// PENDING WILLIAM'S APPROVAL — three-zone cut-points anchored to published norms.
// Each zone has a max boundary (exclusive) on the 0–100 display scale.
// Colors are subtle tints for background segments.

export const SCORE_ZONES = {
  who5: {
    // WHO-5: Topp et al. (2015). Raw ≤13 (displayed ≤52) suggests screening
    // for depression — the established <50 threshold marks the Low zone.
    // Population mean ≈ 68 (raw ≈ 17) sits in Typical. High ≥75 (raw ≥19).
    zones: [
      { label: 'Low', max: 50, color: '#fecaca' },
      { label: 'Typical', max: 75, color: '#e5e7eb' },
      { label: 'High', max: 100, color: '#bbf7d0' },
    ],
  },
  pss4: {
    // PSS-4: Cohen et al. (1983). Norm mean ≈ 6–7 raw.
    // Display inverted: high score = low stress.
    // Low zone: raw >8 (displayed <50) = elevated stress.
    // Typical: raw 4–8 (displayed 50–75). High: raw <4 (displayed >75).
    zones: [
      { label: 'Low', max: 50, color: '#fecaca' },
      { label: 'Typical', max: 75, color: '#e5e7eb' },
      { label: 'High', max: 100, color: '#bbf7d0' },
    ],
  },
  uwes3: {
    // UWES-3: Schaufeli et al. (2006). Norm database bands:
    // Low engagement <3.0 mean (displayed <50).
    // Average 3.0–5.0 (displayed 50–83). High >5.0 (displayed >83).
    zones: [
      { label: 'Low', max: 50, color: '#fecaca' },
      { label: 'Typical', max: 83, color: '#e5e7eb' },
      { label: 'High', max: 100, color: '#bbf7d0' },
    ],
  },
  ucla3: {
    // UCLA-3: Hughes et al. (2004). Raw ≥6 = loneliness classification.
    // (9−6)/6 × 100 = 50 → displayed ≤50 = Low (lonely).
    // Typical: raw 4–5 (displayed 50–83). High: raw 3 (displayed >83).
    zones: [
      { label: 'Low', max: 50, color: '#fecaca' },
      { label: 'Typical', max: 83, color: '#e5e7eb' },
      { label: 'High', max: 100, color: '#bbf7d0' },
    ],
  },
  composite: {
    // Composite: average of the four instruments' Typical-zone upper bounds.
    // (75 + 75 + 83 + 83) / 4 ≈ 79.
    zones: [
      { label: 'Low', max: 50, color: '#fecaca' },
      { label: 'Typical', max: 79, color: '#e5e7eb' },
      { label: 'High', max: 100, color: '#bbf7d0' },
    ],
  },
};

// Backward-compatible typical ranges derived from zone boundaries.
export const TYPICAL_BANDS = Object.fromEntries(
  Object.entries(SCORE_ZONES).map(([key, def]) => [
    key,
    { typicalRange: [def.zones[0].max, def.zones[1].max] },
  ])
);

// Returns 'Low' | 'Typical' | 'High' for a given instrument key (or 'composite').
export function getZone(key, score) {
  if (score == null) return null;
  const zones = SCORE_ZONES[key]?.zones || SCORE_ZONES.composite.zones;
  for (const z of zones) {
    if (score < z.max) return z.label;
  }
  return zones[zones.length - 1].label;
}