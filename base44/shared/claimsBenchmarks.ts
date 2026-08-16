/**
 * ══════════════════════════════════════════════════════════════════════════
 *  CLAIMS BENCHMARKS — the single source of truth for every constant the
 *  Claims Insight calculator uses.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * SOURCE: "SKMS_Claims_Insight_Phase1_Worksheet.xlsx" → Benchmarks sheet
 * (the paper prototype this file replaces), plus the literature review
 * "Reading Mental Health Risk in Employer Claims Data" (Claims Calculator/).
 *
 * This file is imported directly by BOTH runtimes — same pattern as
 * rateCard.ts, its sibling:
 *   · Deno backend functions —  import { ... } from '../../shared/claimsBenchmarks.ts'
 *   · React frontend         —  import { ... } from '@/lib/claimsBenchmarks'
 *     (src/lib/claimsBenchmarks.js re-exports this file, so Vite bundles it)
 *
 * There are no mirrors of this file. If you find a benchmark, weight, band
 * cutoff, or cost constant hard-coded anywhere else, that is a bug — route
 * it through here instead.
 *
 * ── CHANGING A BENCHMARK ──────────────────────────────────────────────────
 * 1. Know why: each constant carries its evidence anchor below. Calibration
 *    against real broker reports is the expected reason (Phase 1 goal).
 * 2. Prefer the Claims Insight admin tab (guarded saves, audit trail) over
 *    editing this file — the shipped defaults here are the fallback.
 * 3. If you DO change a shipped default, update the acceptance expectations
 *    in verifyClaimsScoring() (claimsScoring.ts) — they encode the Phase 1
 *    worksheet's example company and are pinned to THESE defaults.
 * 4. Run the check (npm run check:claims / scripts/checkClaims.mjs).
 *
 * HONESTY RAILS (print with any output; non-negotiable):
 *   · Population-level inference only — no individual identification.
 *   · Claims lag reality by 3–12 months; coded BH prevalence is a floor.
 *   · LOW behavioral spend against a heavy comorbidity shadow is the RISK
 *     signal, never reassurance.
 *   · Estimates are ranges, not promises; educational, not medical or
 *     actuarial advice.
 *   · Clinical-severity flags route to therapy/EAP referral — never to
 *     programming.
 */

// ── Constants ─────────────────────────────────────────────────────────────
//
// CLAIMS_BENCHMARKS_DEFAULTS is what ships in the code. CLAIMS_BENCHMARKS
// below starts as a copy and is the object everything actually reads. The
// admin tab saves overrides to the ClaimsBenchmarkSetting record;
// applyClaimsBenchmarkOverrides() merges them in at load, so a saved value
// takes effect everywhere without anything having to re-import.
export const CLAIMS_BENCHMARKS_DEFAULTS = {
  // ── Population benchmarks ──
  // CDC/NCHS Data Brief 377 (2015–2018): 13.2% of US adults use
  // antidepressants; higher where the workforce skews female.
  adUtilizationBenchmark: 0.13,
  // Assumption — calibrate against real reports.
  anxiolyticBenchmark: 0.06,
  // Typical commercial book 4–5%; Milliman 2020 found 4.4% across 21M members.
  bhSpendShareBenchmark: 0.045,
  // Coded floor — validation literature shows claims under-detect (Fiest 2014).
  codedPrevalenceBenchmark: 0.10,
  // Typical commercial utilization — assumption, calibrate.
  erVisitsPer1000Benchmark: 180,
  // Industry norm 2–8%; low use = reach failure, not low need.
  eapUtilizationBenchmark: 0.05,

  // ── Hidden-cost constants ──
  // Claims sensitivity is modest (validation lit); applied to observed
  // prevalence, result capped at prevalenceCap.
  underDetectionFactor: 1.4,
  prevalenceCap: 0.25,
  // Conservative from Stewart JAMA 2003 ($44B/yr; >80% presenteeism) and
  // Goetzel 2004, inflation-adjusted. At the reference salary below; cost
  // scales linearly with the client's average salary.
  productivityLossPerCase: 5000,
  referenceSalary: 60000,
  // Present the estimate as a range, never a point.
  hiddenCostLowMultiplier: 0.7,
  hiddenCostHighMultiplier: 1.3,
  // Only ~55–70% of antidepressant use treats depression (rest: pain,
  // insomnia, migraine) — Gardarsdottir et al.; PMID 30680859. This is the
  // only population-level factor borrowed from those claim-line algorithms.
  adDepressionAttribution: 0.65,

  // ── Subscore 1 · Identified burden ──
  // Ratio-to-benchmark average is scaled by this to land on 0–100.
  identifiedBurdenScale: 50,
  // Anxiolytic/sedative utilization above its benchmark adds this.
  anxiolyticExcessPoints: 10,
  // TRD pattern / notable antidepressant switching adds this.
  trdPatternPoints: 15,

  // ── Subscore 2 · Unmet-need gap (flagship) ──
  // Milliman 2020: 27% of members drive 56.5% of spend, only 4.4% on BH
  // treatment. Shadow × how thin behavioral care is, amplified.
  unmetNeedBhWeight: 0.6,
  unmetNeedEapWeight: 0.4,
  unmetNeedAmplifier: 1.5,

  // ── Subscore 3 · Comorbidity-shadow weights (sum ≈ 100) ──
  // Undiagnosed mood disorder is common in chronic MSK pain (PMID 23742219).
  weightMsk: 25,
  // MSK ranked 1–2 in top diagnoses adds a small bonus.
  mskTopRankBonus: 5,
  // Sleep clusters with mood, pain, and utilization.
  weightSleep: 20,
  // Chronic overlapping pain conditions literature.
  weightMigraine: 15,
  weightGi: 15,
  // Depression multiplies chronic-disease cost (PMID 19687180; Egede).
  weightCardiometabolic: 15,
  weightErAboveBenchmark: 10,

  // ── Subscore 4 · Clinical-severity flag points ──
  // Any points here route to the referral page regardless of other scores.
  flagPsychEventsPoints: 40,
  flagSudPoints: 30,
  // Milliman: BH members drove 56.5% of total spend.
  flagHccBhPoints: 20,
  flagStdLtdPoints: 10,

  // ── Score bands ──
  bandLowElevated: 35,   // scores below this read Low
  bandElevatedHigh: 65,  // scores above this read High

  // ── Data confidence (of the 11 key report fields) ──
  confidenceHighMin: 9,      // ≥ this many provided → High
  confidenceModerateMin: 5,  // ≥ this many → Moderate; fewer → Low
};

/** The live benchmarks. Mutated in place by applyClaimsBenchmarkOverrides(). */
export const CLAIMS_BENCHMARKS: Record<string, number> = { ...CLAIMS_BENCHMARKS_DEFAULTS };

// ── Runtime overrides (the Claims Insight admin tab) ──────────────────────

export interface ClaimsBenchmarkOverrides {
  values?: Record<string, number>;
}

/** Everything currently in effect — what the admin tab loads for editing. */
export function currentClaimsBenchmarks(): Required<ClaimsBenchmarkOverrides> {
  return { values: { ...CLAIMS_BENCHMARKS } };
}

/** The shipped defaults — what "Reset to default" restores. */
export function defaultClaimsBenchmarks(): Required<ClaimsBenchmarkOverrides> {
  return { values: { ...CLAIMS_BENCHMARKS_DEFAULTS } };
}

/**
 * Merge saved overrides into the live benchmarks, in place, so every module
 * that already imported CLAIMS_BENCHMARKS sees the new values.
 *
 * Unknown keys and non-finite numbers are ignored rather than trusted — a
 * malformed record must not be able to zero out a benchmark.
 */
export function applyClaimsBenchmarkOverrides(
  overrides: ClaimsBenchmarkOverrides | null | undefined,
): string[] {
  const applied: string[] = [];
  if (!overrides) return applied;
  for (const [k, v] of Object.entries(overrides.values || {})) {
    if (!(k in CLAIMS_BENCHMARKS_DEFAULTS)) continue;
    if (typeof v !== 'number' || !isFinite(v) || v < 0) continue;
    CLAIMS_BENCHMARKS[k] = v;
    applied.push(k);
  }
  return applied;
}

/** Restore the shipped defaults. */
export function resetClaimsBenchmarks(): void {
  for (const k of Object.keys(CLAIMS_BENCHMARKS)) delete CLAIMS_BENCHMARKS[k];
  Object.assign(CLAIMS_BENCHMARKS, CLAIMS_BENCHMARKS_DEFAULTS);
}

/**
 * Checks the RAW input from the admin tab before it is merged.
 * applyClaimsBenchmarkOverrides deliberately ignores anything malformed, but
 * silently dropping a value the user typed would be worse than refusing it.
 */
export function validateClaimsBenchmarkInput(
  overrides: ClaimsBenchmarkOverrides | null | undefined,
): string[] {
  const problems: string[] = [];
  if (!overrides) return problems;
  for (const [k, v] of Object.entries(overrides.values || {})) {
    if (!(k in CLAIMS_BENCHMARKS_DEFAULTS)) { problems.push(`"${k}" is not a known benchmark`); continue; }
    if (typeof v !== 'number' || !isFinite(v)) { problems.push(`"${k}" must be a number`); continue; }
    if (v < 0) problems.push(`"${k}" cannot be negative`);
  }
  return problems;
}

/**
 * Rules that must hold for ANY valid benchmark set, whatever the values are.
 * The admin tab refuses to save when this returns anything. Distinct from
 * verifyClaimsScoring() (claimsScoring.ts), which checks agreement with the
 * Phase 1 worksheet and is expected to fail the moment a default changes.
 */
export function verifyClaimsBenchmarkIntegrity(
  candidate?: ClaimsBenchmarkOverrides,
): string[] {
  const problems: string[] = [];
  const snapshot = currentClaimsBenchmarks();
  if (candidate) applyClaimsBenchmarkOverrides(candidate);
  const B = CLAIMS_BENCHMARKS;
  try {
    for (const [k, v] of Object.entries(B)) {
      if (!isFinite(v) || v < 0) problems.push(`${k} must be a number of 0 or more`);
    }
    const rate = (key: string, label: string) => {
      if (B[key] <= 0 || B[key] > 1) problems.push(`${label} must be between 0 and 1 (0.13 = 13%)`);
    };
    rate('adUtilizationBenchmark', 'Antidepressant benchmark');
    rate('anxiolyticBenchmark', 'Anxiolytic benchmark');
    rate('bhSpendShareBenchmark', 'BH % of spend benchmark');
    rate('codedPrevalenceBenchmark', 'Coded prevalence benchmark');
    rate('eapUtilizationBenchmark', 'EAP utilization benchmark');
    rate('prevalenceCap', 'Prevalence cap');
    rate('adDepressionAttribution', 'AD → depression attribution');
    if (B.underDetectionFactor < 1) problems.push('Under-detection factor below 1 would say claims OVER-detect — that contradicts the validation literature this tool cites');
    if (B.erVisitsPer1000Benchmark < 1) problems.push('ER visits/1,000 benchmark must be at least 1');
    if (B.referenceSalary <= 0) problems.push('Reference salary must be above 0');
    if (B.productivityLossPerCase <= 0) problems.push('Productivity loss per case must be above 0');
    if (B.hiddenCostLowMultiplier > B.hiddenCostHighMultiplier) problems.push('The hidden-cost LOW multiplier is above the HIGH multiplier — the range would be inverted');
    if (B.hiddenCostLowMultiplier <= 0) problems.push('Hidden-cost low multiplier must be above 0');
    if (!(B.bandLowElevated < B.bandElevatedHigh)) problems.push('The Low/Elevated cutoff must sit below the Elevated/High cutoff');
    if (B.bandLowElevated <= 0 || B.bandElevatedHigh >= 100) problems.push('Band cutoffs must sit inside 0–100');
    const shadowSum = B.weightMsk + B.weightSleep + B.weightMigraine + B.weightGi + B.weightCardiometabolic + B.weightErAboveBenchmark;
    if (shadowSum < 50 || shadowSum > 150) problems.push(`Comorbidity-shadow weights sum to ${shadowSum} — they should stay near 100 so the subscore keeps its 0–100 meaning`);
    if (B.unmetNeedBhWeight + B.unmetNeedEapWeight <= 0) problems.push('The unmet-need BH and EAP weights cannot both be 0');
    if (B.unmetNeedAmplifier <= 0) problems.push('The unmet-need amplifier must be above 0');
    if (B.confidenceModerateMin > B.confidenceHighMin) problems.push('The Moderate confidence threshold is above the High threshold');
    if (B.confidenceHighMin > 11) problems.push('The High confidence threshold cannot exceed the 11 counted fields');
  } finally {
    if (candidate) { resetClaimsBenchmarks(); applyClaimsBenchmarkOverrides(snapshot); }
  }
  return [...new Set(problems)];
}
