/**
 * ══════════════════════════════════════════════════════════════════════════
 *  CLAIMS SCORING — the pure Claims Insight engine.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A faithful port of the Phase 1 worksheet's Profile-sheet formulas
 * (SKMS_Claims_Insight_Phase1_Worksheet.xlsx). The worksheet is the spec;
 * verifyClaimsScoring() below pins this engine to its example company and
 * MUST pass before any UI change ships.
 *
 * Deterministic, no I/O, no UI — the same engine serves the internal module
 * today and the public broker link (Phase 3) unchanged. All constants come
 * from claimsBenchmarks.ts; nothing numeric lives here.
 *
 * ── BLANK SEMANTICS (deliberate, from the worksheet) ──────────────────────
 * A field the report doesn't have is BLANK, and blanks degrade honestly:
 *   · Subscore 1 blanks out only when BOTH prevalence proxies are missing.
 *   · Subscore 2 blanks out without BH % of spend.
 *   · Subscores 3 and 4 treat missing signals as absent (they only add).
 *   · The hidden-cost estimate is NULL — not $0 — when its inputs are
 *     missing (headcount, salary, or both prevalence proxies). This is the
 *     one deliberate departure from the spreadsheet, which shows a
 *     meaningless $0 there; "blanks give blank scores, never fake zeros."
 */

import { CLAIMS_BENCHMARKS } from './claimsBenchmarks.ts';

// ── Inputs ────────────────────────────────────────────────────────────────
// Field keys mirror the worksheet's Intake sheet, blocks A–E. Everything is
// optional except headcount (Block A is the only required block). Yes/no
// fields accept 'Y' | 'N' | boolean; numbers accept numeric strings.
// Stored as a flexible JSON blob on ClaimsProfile so field-list updates from
// broker feedback stay cheap.

export interface ClaimsInputs {
  // Block A — Population (required)
  headcount?: number | string | null;
  pctFemale?: number | string | null;
  avgSalary?: number | string | null;
  industry?: string | null;
  // Block B — Spend shape
  pmpm?: number | string | null;
  bhSpendShare?: number | string | null;
  erVisitsPer1000?: number | string | null;
  // Block C — Behavioral signals
  codedPrevalence?: number | string | null;
  adUtilization?: number | string | null;
  anxiolyticUtilization?: number | string | null;
  psychEvents?: number | string | null;
  sudPresent?: string | boolean | null;
  trdPattern?: string | boolean | null;
  // Block D — Comorbidity shadow
  mskTop5?: string | boolean | null;
  mskRank?: number | string | null;
  sleepSignal?: string | boolean | null;
  migraineSignal?: string | boolean | null;
  giSignal?: string | boolean | null;
  cardiometabolicTop5?: string | boolean | null;
  // Block E — High-cost claimants & absence
  hccPctOfSpend?: number | string | null;
  hccBhCondition?: string | boolean | null;
  mhDisability?: string | boolean | null;
  eapUtilization?: number | string | null;
}

export type Band = 'Low' | 'Elevated' | 'High';
export type Confidence = 'Low' | 'Moderate' | 'High';

export interface Subscore {
  key: string;
  label: string;
  /** null = the report didn't have the fields this subscore needs. */
  score: number | null;
  band: Band | null;
  /** Plain-language "how it's computed", shown next to the number. */
  method: string;
}

export interface ReferralFlag {
  key: string;
  text: string;
}

export interface HiddenCost {
  correctedPrevalence: number;
  affectedEmployees: number;
  low: number;
  high: number;
}

export interface ClaimsScoreResult {
  subscores: {
    identifiedBurden: Subscore;
    unmetNeedGap: Subscore;
    comorbidityShadow: Subscore;
    clinicalFlags: Subscore;
  };
  confidence: Confidence;
  fieldsProvided: number;
  fieldsCounted: number;
  /** null when headcount, salary, or both prevalence proxies are missing. */
  hiddenCost: HiddenCost | null;
  referralFlags: ReferralFlag[];
  /** True the moment subscore 4 has any points — referral page always shows. */
  hasClinicalFlags: boolean;
}

// ── Blank-safe readers (Excel semantics) ──────────────────────────────────

/** Excel "" test: null, undefined, '' and non-numeric strings are blank. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,%$\s]/g, ''));
  return isFinite(n) ? n : null;
}

/** Y/N field → true / false / null(blank). Accepts booleans and y/yes. */
function yn(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'y' || s === 'yes' || s === 'true') return true;
  if (s === 'n' || s === 'no' || s === 'false') return false;
  return null;
}

function band(score: number | null): Band | null {
  if (score === null) return null;
  const B = CLAIMS_BENCHMARKS;
  if (score < B.bandLowElevated) return 'Low';
  if (score <= B.bandElevatedHigh) return 'Elevated';
  return 'High';
}

/** Excel ROUND (half away from zero); scores are non-negative so this is Math.round. */
const round0 = (n: number) => Math.round(n);

// ── The engine ────────────────────────────────────────────────────────────

export function scoreClaimsProfile(inputs: ClaimsInputs): ClaimsScoreResult {
  const B = CLAIMS_BENCHMARKS;

  const headcount = num(inputs.headcount);
  const avgSalary = num(inputs.avgSalary);
  const pmpm = num(inputs.pmpm);
  const bhShare = num(inputs.bhSpendShare);
  const er = num(inputs.erVisitsPer1000);
  const coded = num(inputs.codedPrevalence);
  const ad = num(inputs.adUtilization);
  const anx = num(inputs.anxiolyticUtilization);
  const psychEvents = num(inputs.psychEvents);
  const sud = yn(inputs.sudPresent);
  const trd = yn(inputs.trdPattern);
  const msk = yn(inputs.mskTop5);
  const mskRank = num(inputs.mskRank);
  const sleep = yn(inputs.sleepSignal);
  const migraine = yn(inputs.migraineSignal);
  const gi = yn(inputs.giSignal);
  const cardio = yn(inputs.cardiometabolicTop5);
  const hccPct = num(inputs.hccPctOfSpend);
  const hccBh = yn(inputs.hccBhCondition);
  const stdLtd = yn(inputs.mhDisability);
  const eap = num(inputs.eapUtilization);

  // ── Subscore 1 · Identified burden ──
  // Ratio of AD utilization and coded prevalence to their benchmarks,
  // averaged (a missing one lets the other stand in), scaled; anxiolytics
  // above benchmark and a TRD pattern add points.
  let identifiedBurden: number | null = null;
  if (ad !== null || coded !== null) {
    const adRatio = ad !== null ? ad / B.adUtilizationBenchmark : (coded as number) / B.codedPrevalenceBenchmark;
    const codedRatio = coded !== null ? coded / B.codedPrevalenceBenchmark : (ad as number) / B.adUtilizationBenchmark;
    let s = B.identifiedBurdenScale * ((adRatio + codedRatio) / 2);
    if (anx !== null && anx > B.anxiolyticBenchmark) s += B.anxiolyticExcessPoints;
    if (trd === true) s += B.trdPatternPoints;
    identifiedBurden = Math.min(100, round0(s));
  }

  // ── Subscore 3 · Stress-linked comorbidity shadow ── (computed before 2,
  // which reads it — same as the worksheet's cell order dependency)
  let shadow = 0;
  if (msk === true) {
    shadow += B.weightMsk;
    if (mskRank !== null && mskRank > 0 && mskRank <= 2) shadow += B.mskTopRankBonus;
  }
  if (sleep === true) shadow += B.weightSleep;
  if (migraine === true) shadow += B.weightMigraine;
  if (gi === true) shadow += B.weightGi;
  if (cardio === true) shadow += B.weightCardiometabolic;
  if (er !== null && er > B.erVisitsPer1000Benchmark) shadow += B.weightErAboveBenchmark;
  const comorbidityShadow = Math.min(100, shadow);

  // ── Subscore 2 · Unmet-need gap (flagship) ──
  // Comorbidity shadow × how thin behavioral care is (BH % of spend and EAP
  // reach vs. benchmark), amplified. High shadow + thin care = the Milliman
  // signature. LOW spend is scored as RISK here, never as reassurance.
  let unmetNeedGap: number | null = null;
  if (bhShare !== null) {
    const bhThin = Math.max(0, 1 - bhShare / B.bhSpendShareBenchmark);
    const eapThin = eap !== null ? Math.max(0, 1 - eap / B.eapUtilizationBenchmark) : bhThin;
    const gap = comorbidityShadow
      * (B.unmetNeedBhWeight * bhThin + B.unmetNeedEapWeight * eapThin)
      * B.unmetNeedAmplifier;
    unmetNeedGap = Math.min(100, round0(gap));
  }

  // ── Subscore 4 · Clinical-severity flags ──
  let flags = 0;
  if (psychEvents !== null && psychEvents > 0) flags += B.flagPsychEventsPoints;
  if (sud === true) flags += B.flagSudPoints;
  if (hccBh === true) flags += B.flagHccBhPoints;
  if (stdLtd === true) flags += B.flagStdLtdPoints;
  const clinicalFlags = Math.min(100, flags);

  // ── Data confidence — the worksheet's 11 key report fields ──
  const counted = [pmpm, bhShare, er, coded, ad, anx, psychEvents,
    msk === null ? null : 1, sleep === null ? null : 1, hccPct, eap];
  const fieldsProvided = counted.filter(v => v !== null).length;
  const confidence: Confidence =
    fieldsProvided >= B.confidenceHighMin ? 'High'
    : fieldsProvided >= B.confidenceModerateMin ? 'Moderate'
    : 'Low';

  // ── Hidden cost (presenteeism + absenteeism) ──
  // Max of coded prevalence and depression-attributed AD use, corrected
  // upward for under-detection, capped; × per-case loss × salary ratio ×
  // range multipliers. NULL — never $0 — when its inputs are missing.
  let hiddenCost: HiddenCost | null = null;
  if (headcount !== null && headcount > 0 && avgSalary !== null && avgSalary > 0
      && (coded !== null || ad !== null)) {
    const correctedPrevalence = Math.min(
      B.prevalenceCap,
      Math.max(coded ?? 0, (ad ?? 0) * B.adDepressionAttribution) * B.underDetectionFactor,
    );
    const affectedEmployees = headcount * correctedPrevalence;
    const base = affectedEmployees * B.productivityLossPerCase * (avgSalary / B.referenceSalary);
    hiddenCost = {
      correctedPrevalence,
      affectedEmployees,
      low: base * B.hiddenCostLowMultiplier,
      high: base * B.hiddenCostHighMultiplier,
    };
  }

  // ── Clinical referral flags (therapy / EAP — never programming) ──
  const referralFlags: ReferralFlag[] = [];
  if (psychEvents !== null && psychEvents > 0) {
    referralFlags.push({
      key: 'psych_events',
      text: `REFER — ${psychEvents} psych inpatient/behavioral ER event(s): review BH network adequacy + warm-handoff pathway`,
    });
  }
  if (sud === true) {
    referralFlags.push({
      key: 'sud',
      text: 'REFER — SUD-related claims: EAP + SUD treatment benefits; stigma-reduction content only from SkillfulMeans',
    });
  }
  if (trd === true) {
    referralFlags.push({
      key: 'trd',
      text: 'REFER — treatment-resistant pattern: psychiatry / collaborative care conversation with the broker',
    });
  }
  if (hccBh === true) {
    referralFlags.push({
      key: 'hcc_bh',
      text: 'REFER — high-cost claimant(s) with BH condition: carrier case management; benefits-design conversation',
    });
  }
  if (eap !== null && eap < B.eapUtilizationBenchmark) {
    referralFlags.push({
      key: 'eap_reach',
      text: `EAP REACH FAILURE — utilization ${(eap * 100).toFixed(1)}% vs ${Math.round(B.eapUtilizationBenchmark * 100)}% benchmark: rebuild awareness + reduce friction; track referral reach`,
    });
  }

  return {
    subscores: {
      identifiedBurden: {
        key: 'identified_burden',
        label: '1. Identified burden',
        score: identifiedBurden,
        band: band(identifiedBurden),
        method: 'Antidepressant + diagnosed prevalence vs. benchmarks; anxiolytics and TRD pattern add points',
      },
      unmetNeedGap: {
        key: 'unmet_need_gap',
        label: '2. Unmet-need gap',
        score: unmetNeedGap,
        band: band(unmetNeedGap),
        method: 'Comorbidity shadow × how thin behavioral care is (BH% and EAP vs. benchmark). High shadow + thin care = the Milliman signature',
      },
      comorbidityShadow: {
        key: 'comorbidity_shadow',
        label: '3. Stress-linked comorbidity shadow',
        score: comorbidityShadow,
        band: band(comorbidityShadow),
        method: 'Weighted MSK, sleep, migraine, GI, cardiometabolic, and ER pressure — where under-coded distress shows up',
      },
      clinicalFlags: {
        key: 'clinical_flags',
        label: '4. Clinical-severity flags',
        score: clinicalFlags,
        band: band(clinicalFlags),
        method: 'Psych events, SUD, BH high-cost claimants, MH disability. ANY points here → referral page, always',
      },
    },
    confidence,
    fieldsProvided,
    fieldsCounted: counted.length,
    hiddenCost,
    referralFlags,
    hasClinicalFlags: clinicalFlags > 0,
  };
}

// ── Campaign recommendation (build plan §4) ───────────────────────────────
// Maps the scored signals to a sequenced SkillfulMeans campaign. Stepped-care
// logic: match intensity to need, sequence for habit formation, always
// include measurement, never sell a one-off as a fix (Fleming 2024: buffet-
// style offerings show no average benefit — the reason this is a SEQUENCED
// campaign). Packaging targets the locked QuickBuilder tiers; pricing flows
// through rateCard.ts — never priced here.

export interface CampaignSignal {
  key: string;
  label: string;
  trigger: string;
  response: string;
  mechanism: string;
}

export interface CampaignRecommendation {
  stage: number;
  stageRationale: string;
  signals: CampaignSignal[];
  sequence: string[];
  measurementPlan: string[];
  expectedOutcomeLanguage: string;
}

export function recommendClaimsCampaign(
  result: ClaimsScoreResult,
  inputs: ClaimsInputs,
): CampaignRecommendation {
  const B = CLAIMS_BENCHMARKS;
  const s = result.subscores;
  const signals: CampaignSignal[] = [];

  const shadowHigh = (s.comorbidityShadow.score ?? 0) > B.bandElevatedHigh;
  const gapHigh = (s.unmetNeedGap.score ?? 0) > B.bandElevatedHigh;
  const gapElevated = (s.unmetNeedGap.score ?? 0) >= B.bandLowElevated;
  const burdenScore = s.identifiedBurden.score;
  const sleepOn = yn(inputs.sleepSignal) === true
    || ((num(inputs.anxiolyticUtilization) ?? 0) > B.anxiolyticBenchmark);
  const cardioOn = yn(inputs.cardiometabolicTop5) === true;
  const bhThin = (num(inputs.bhSpendShare) ?? B.bhSpendShareBenchmark) < B.bhSpendShareBenchmark;

  if (shadowHigh || (s.comorbidityShadow.score ?? 0) >= B.bandLowElevated) {
    signals.push({
      key: 'burnout_shadow',
      label: 'Stress/burnout shadow',
      trigger: 'MSK, sleep, and related comorbidity signals with the stress profile of under-coded distress',
      response: 'Beyond Burnout workshop (sections per 1,000 employees) → 14-day challenge → weekly mindfulness/movement classes; wellness boxes as the cultural signal',
      mechanism: 'Universal CBT-informed + mindfulness skill-building (Tan 2014; Bartlett 2019); dose past day 66 for habit automaticity',
    });
  }
  if (sleepOn) {
    signals.push({
      key: 'sleep',
      label: 'Sleep-specific signal',
      trigger: 'Sedative/sleep-Rx or sleep-disorder signal in the report',
      response: 'Sleep-focused workshop topic + sleep-hygiene challenge track',
      mechanism: 'Sleep is a modifiable driver of mood, pain, and utilization; low-stigma entry point',
    });
  }
  if (gapHigh || (gapElevated && bhThin)) {
    signals.push({
      key: 'unmet_need',
      label: 'Diffuse unmet need, thin behavioral care',
      trigger: 'High unmet-need gap: heavy comorbidity shadow with low BH utilization/spend',
      response: 'Culture-first campaign: awareness workshops incl. Mental Health, Grief & Addiction (with "when to seek help" content), prosocial/kindness challenge, EAP re-introduction woven into every touchpoint',
      mechanism: 'Prosocial activity is the best-evidenced universal lever (Fleming 2024); signposting reduces help-seeking friction; targets the 25% norm-tipping threshold',
    });
  }
  if (cardioOn && (burdenScore ?? 0) >= B.bandLowElevated) {
    signals.push({
      key: 'cardiometabolic',
      label: 'Cardiometabolic + depression comorbidity pattern',
      trigger: 'Diabetes/cardiometabolic in top diagnoses alongside an elevated identified burden',
      response: 'Movement classes + habit challenge co-branded with any existing disease-management vendor; coordination note to the broker',
      mechanism: 'Depression multiplies chronic-disease cost; behavior-change support complements, never replaces, medical management',
    });
  }
  if (signals.length === 0) {
    signals.push({
      key: 'foundation',
      label: 'Prevention-first foundation',
      trigger: 'No elevated risk signals in the provided fields (or too few fields to see them)',
      response: 'Foundation campaign: mental-fitness workshop → 14-day challenge to establish shared language and habit',
      mechanism: 'Universal prevention holds gains cheaply while the data picture improves at next renewal',
    });
  }

  // Stage: intensity matched to need (stepped care), one notch of headroom.
  const scores = [s.identifiedBurden.score, s.unmetNeedGap.score, s.comorbidityShadow.score]
    .filter((v): v is number => v !== null);
  const peak = scores.length ? Math.max(...scores) : 0;
  let stage: number;
  let stageRationale: string;
  if (peak > B.bandElevatedHigh) {
    stage = 3;
    stageRationale = 'A High band on the programming subscores calls for Stage 3 (Resilience): sustained sequencing plus Leadership EQ, because leaders control the job demands and resources that drive the shadow signals.';
  } else if (peak >= B.bandLowElevated) {
    stage = 2;
    stageRationale = 'Elevated (not High) programming subscores call for Stage 2 (Momentum): enough workshops and challenges to build lasting habits without over-selling intensity the data does not yet justify.';
  } else {
    stage = 1;
    stageRationale = 'Low programming subscores call for Stage 1 (Spark): establish shared language and initial habit, then re-read the claims picture at renewal.';
  }

  return {
    stage,
    stageRationale,
    signals,
    sequence: [
      'Workshop(s) first — shared language and a visible cultural signal',
      '14-day challenge within 30 days — convert language into daily practice',
      'Ongoing classes / next workshop topics — dose past day 66 for habit automaticity',
      'EAP and clinical signposting woven into every touchpoint — never a separate afterthought',
    ],
    measurementPlan: [
      'WHO-5 or SWEMWBS pulse at baseline and campaign end',
      'Participation reach % against the 25% norm-tipping threshold',
      'Next-renewal claims re-read (this calculator, same fields) as the lagging indicator',
    ],
    expectedOutcomeLanguage: 'Framed as what is achievable in well-run programs — never a guarantee.',
  };
}

// ── Acceptance test (the Phase 1 worksheet's example company) ─────────────
// The worksheet IS the spec. This must return [] against the shipped
// defaults BEFORE any UI work ships, and again after any engine change.
// Expected values were read from the worksheet's computed cells:
//   subscores 51 / 59 / 90 / 90 (Elevated / Elevated / High / High),
//   confidence High (11 of 11 fields), corrected prevalence 11.2%,
//   hidden cost $377,626.67 – $701,306.67.

export const WORKSHEET_EXAMPLE_INPUTS: ClaimsInputs = {
  headcount: 850,
  pctFemale: 0.55,
  avgSalary: 68000,
  industry: 'Professional services',
  pmpm: 520,
  bhSpendShare: 0.03,
  erVisitsPer1000: 210,
  codedPrevalence: 0.08,
  adUtilization: 0.11,
  anxiolyticUtilization: 0.07,
  psychEvents: 3,
  sudPresent: 'Y',
  trdPattern: 'N',
  mskTop5: 'Y',
  mskRank: 2,
  sleepSignal: 'Y',
  migraineSignal: 'N',
  giSignal: 'Y',
  cardiometabolicTop5: 'Y',
  hccPctOfSpend: 0.31,
  hccBhCondition: 'Y',
  mhDisability: 'N',
  eapUtilization: 0.02,
};

export function verifyClaimsScoring(): string[] {
  const failures: string[] = [];
  const r = scoreClaimsProfile(WORKSHEET_EXAMPLE_INPUTS);
  const s = r.subscores;

  const expectScore = (sub: Subscore, score: number, b: Band) => {
    if (sub.score !== score) failures.push(`${sub.label}: score ${sub.score} != ${score}`);
    if (sub.band !== b) failures.push(`${sub.label}: band ${sub.band} != ${b}`);
  };
  expectScore(s.identifiedBurden, 51, 'Elevated');
  expectScore(s.unmetNeedGap, 59, 'Elevated');
  expectScore(s.comorbidityShadow, 90, 'High');
  expectScore(s.clinicalFlags, 90, 'High');

  if (r.confidence !== 'High') failures.push(`confidence ${r.confidence} != High`);
  if (r.fieldsProvided !== 11) failures.push(`fieldsProvided ${r.fieldsProvided} != 11`);

  if (!r.hiddenCost) {
    failures.push('hiddenCost is null for the fully-populated example');
  } else {
    const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
    if (!close(r.hiddenCost.correctedPrevalence, 0.112, 1e-9)) failures.push(`correctedPrevalence ${r.hiddenCost.correctedPrevalence} != 0.112`);
    if (!close(r.hiddenCost.affectedEmployees, 95.2, 1e-9)) failures.push(`affectedEmployees ${r.hiddenCost.affectedEmployees} != 95.2`);
    if (!close(r.hiddenCost.low, 377626.666666667, 0.01)) failures.push(`hidden cost low ${r.hiddenCost.low} != 377626.67`);
    if (!close(r.hiddenCost.high, 701306.666666667, 0.01)) failures.push(`hidden cost high ${r.hiddenCost.high} != 701306.67`);
  }

  const flagKeys = r.referralFlags.map(f => f.key).sort().join(',');
  const expectedFlags = ['eap_reach', 'hcc_bh', 'psych_events', 'sud'].join(',');
  if (flagKeys !== expectedFlags) failures.push(`referral flags [${flagKeys}] != [${expectedFlags}]`);
  if (!r.hasClinicalFlags) failures.push('hasClinicalFlags should be true for the example');

  // ── Sparse-input honesty: blanks give blank scores, never fake zeros ──
  const sparse = scoreClaimsProfile({ headcount: 850 });
  if (sparse.subscores.identifiedBurden.score !== null) failures.push('sparse: identified burden should be null with no prevalence fields');
  if (sparse.subscores.unmetNeedGap.score !== null) failures.push('sparse: unmet-need gap should be null with no BH % of spend');
  if (sparse.hiddenCost !== null) failures.push('sparse: hidden cost should be null, never $0');
  if (sparse.confidence !== 'Low') failures.push(`sparse: confidence ${sparse.confidence} != Low`);
  if (sparse.referralFlags.length !== 0) failures.push('sparse: no referral flags should fire on an empty report');

  // Rx-only report still produces a useful profile (build plan §2).
  const rxOnly = scoreClaimsProfile({ headcount: 850, avgSalary: 68000, adUtilization: 0.11 });
  if (rxOnly.subscores.identifiedBurden.score === null) failures.push('rx-only: identified burden should score from AD utilization alone');
  if (rxOnly.hiddenCost === null) failures.push('rx-only: hidden cost should compute from AD utilization alone');

  return failures;
}
