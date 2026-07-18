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

// ── Typical-range bands ──
// PENDING WILLIAM'S APPROVAL — rendered only as "typical range" labels.
// Sources cited in comments.
export const TYPICAL_BANDS = {
  who5: {
    // WHO-5: Topp et al. (2015). <50 suggests screening for depression.
    // General population mean ≈ 68 (raw ≈ 17).
    typicalRange: [50, 68],
  },
  pss4: {
    // PSS-4: Cohen et al. (1983). Normative mean ≈ 4.5–5.5 raw → 66–72 inverted.
    typicalRange: [60, 72],
  },
  uwes3: {
    // UWES-3: Schaufeli et al. (2006). Normative mean ≈ 4.0 → 67 normalized.
    typicalRange: [55, 75],
  },
  ucla3: {
    // UCLA-3: Hughes et al. (2004). Population mean ≈ 5.6 raw → 57 inverted.
    typicalRange: [48, 60],
  },
};