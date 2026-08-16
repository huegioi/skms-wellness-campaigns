/**
 * The Claims Insight intake field list — blocks A–E from the Phase 1
 * worksheet, which is the frozen-for-now spec. When broker feedback arrives,
 * edit THIS file (labels, hints, order, add/cut fields); the engine reads
 * whatever keys exist in the inputs blob, so field changes stay cheap.
 *
 * Types:
 *   number   — plain count/value
 *   percent  — entered as a percentage (11 → stored 0.11)
 *   currency — dollars
 *   yn       — Yes / No / blank picklist
 *   rank     — 1–5 picklist
 *   pick     — one of `options`
 * Everything is optional except headcount. Blank = the report doesn't have
 * it — the engine degrades confidence honestly instead of faking a zero.
 * Numbers and picklists ONLY: no uploads, no names, no member IDs.
 */

export const INDUSTRY_OPTIONS = [
  'Professional services', 'Healthcare', 'Technology', 'Manufacturing',
  'Financial services', 'Education', 'Public sector', 'Retail', 'Hospitality',
  'Construction', 'Transportation & logistics', 'Nonprofit', 'Other',
];

export const CLAIMS_BLOCKS = [
  {
    key: 'A',
    title: 'Block A — Population',
    required: true,
    why: 'Sets the benchmarks: antidepressant use runs ~13% of US adults, higher where the workforce skews female; industry sets stressor priors.',
    fields: [
      { key: 'headcount', label: 'Enrolled employees (headcount)', type: 'number', required: true, hint: 'Employees on the plan, not total members' },
      { key: 'pctFemale', label: '% female', type: 'percent', hint: 'Antidepressant benchmark runs higher in majority-female workforces' },
      { key: 'avgSalary', label: 'Average annual salary', type: 'currency', hint: 'Ask HR if not in the report — drives the hidden-cost estimate' },
      { key: 'industry', label: 'Industry', type: 'pick', options: INDUSTRY_OPTIONS, hint: 'Context only in Phase 2' },
    ],
  },
  {
    key: 'B',
    title: 'Block B — Spend shape',
    why: 'Behavioral health is ~4–5% of spend in typical books; the Milliman gap analysis needs BH% against comorbidity load.',
    fields: [
      { key: 'pmpm', label: 'Total paid claims PMPM', type: 'currency', hint: 'Total paid ÷ member months' },
      { key: 'bhSpendShare', label: 'Behavioral health % of total spend', type: 'percent', hint: 'Often its own line in the service-category breakdown' },
      { key: 'erVisitsPer1000', label: 'ER visits per 1,000 members', type: 'number', hint: 'Utilization section' },
    ],
  },
  {
    key: 'C',
    title: 'Block C — Behavioral signals',
    why: 'Coded prevalence is a floor (validation literature); Rx classes are the most complete proxy; psych ER/inpatient and SUD are clinical-tier flags.',
    fields: [
      { key: 'codedPrevalence', label: 'Diagnosed depression/anxiety prevalence', type: 'percent', hint: 'Coded prevalence — treated as a floor, if reported' },
      { key: 'adUtilization', label: 'Antidepressant utilization (% of members)', type: 'percent', hint: 'From top drug classes; the most complete proxy' },
      { key: 'anxiolyticUtilization', label: 'Anxiolytic/sedative utilization', type: 'percent', hint: 'From top drug classes' },
      { key: 'psychEvents', label: 'Psych inpatient or behavioral ER events (count)', type: 'number', hint: 'Any >0 triggers the referral section' },
      { key: 'sudPresent', label: 'SUD-related claims present', type: 'yn' },
      { key: 'trdPattern', label: 'TRD pattern / notable antidepressant switching', type: 'yn', hint: 'Multiple switches/augmentation if the report shows it; usually unknown' },
    ],
  },
  {
    key: 'D',
    title: 'Block D — Comorbidity shadow',
    why: 'Chronic pain, sleep, migraine, and GI cluster with undiagnosed mood disorder; depression multiplies chronic-disease cost. This is where under-coded distress shows up.',
    fields: [
      { key: 'mskTop5', label: 'MSK / back pain in top 5 diagnoses', type: 'yn' },
      { key: 'mskRank', label: 'If yes: MSK rank (1–5)', type: 'rank', showIf: { key: 'mskTop5', equals: 'Y' }, hint: 'Rank 1–2 adds a small bonus to the shadow score' },
      { key: 'sleepSignal', label: 'Sleep disorder or sleep-Rx signal', type: 'yn', hint: 'Sleep dx in top categories OR sedative/hypnotic in top drug classes' },
      { key: 'migraineSignal', label: 'Migraine/headache signal', type: 'yn' },
      { key: 'giSignal', label: 'GI/functional signal', type: 'yn', hint: 'IBS, dyspepsia, functional GI in top categories' },
      { key: 'cardiometabolicTop5', label: 'Diabetes / cardiometabolic in top 5', type: 'yn', hint: 'Scores via its interaction with depression, not as pure disease burden' },
    ],
  },
  {
    key: 'E',
    title: 'Block E — High-cost claimants & absence',
    why: 'High-cost claimants with BH comorbidity are the Milliman 56.5% story in miniature; low EAP use is a reach failure, not low need.',
    fields: [
      { key: 'hccPctOfSpend', label: 'High-cost claimants: % of total spend', type: 'percent', hint: "e.g. 'top 10 claimants = 31% of spend'" },
      { key: 'hccBhCondition', label: 'Any high-cost claimant with a BH condition', type: 'yn', hint: 'Primary or secondary; de-identified HCC summaries usually say' },
      { key: 'mhDisability', label: 'MH-related STD/LTD claims', type: 'yn', hint: 'If a disability report is available' },
      { key: 'eapUtilization', label: 'EAP utilization', type: 'percent', hint: 'From the EAP vendor report if HR has it' },
    ],
  },
];

export const HONESTY_RAILS = [
  'Population-level inference only. This tool cannot and does not identify individuals.',
  'Claims lag reality by 3–12 months. Coded behavioral health prevalence is a floor, never a ceiling.',
  'A LOW behavioral health number is not reassurance — scored against a heavy comorbidity shadow, it is the risk signal.',
  'All outputs are educational estimates, not medical or actuarial advice. Ranges, not promises.',
  'Clinical-severity flags route to therapy/EAP referral — never to programming.',
];

/** Referral boundary table (build plan §5) — printed on its own page, deliberately. */
export const REFERRAL_BOUNDARY = [
  { signal: 'Psych inpatient admissions, behavioral ER visits', belongsWith: 'Clinical treatment; carrier BH network; case management', role: 'Design the warm-handoff pathway; "when to seek help" content in Tier 0; manager referral training' },
  { signal: 'SUD-related claims', belongsWith: 'EAP, SUD treatment benefits, MAT providers', role: 'Stigma-reduction content; never positioned as treatment; signpost repeatedly' },
  { signal: 'TRD pattern (multiple antidepressant switches), BH high-cost claimants', belongsWith: 'Psychiatry, collaborative care, carrier case management', role: 'Flag to broker/HR as a benefits-design conversation (BH network adequacy, collaborative care)' },
  { signal: 'High identified burden + adequate treatment engagement', belongsWith: 'Continue clinical care', role: 'Complementary skills programming; coordination, not substitution' },
  { signal: 'Low EAP utilization anywhere risk is elevated', belongsWith: 'EAP (reintroduced properly)', role: 'Treat as a reach failure: rebuild awareness, reduce friction, track referral reach as a program metric' },
  { signal: 'Any acute-crisis indication', belongsWith: '988, crisis services, EAP critical-incident response', role: 'Out of scope, stated plainly; crisis resources listed in every client portal' },
];

/** Evidence anchors per subscore (output page 5). */
export const SUBSCORE_EVIDENCE = [
  { label: '1. Identified burden', logic: 'Diagnosed prevalence + antidepressant/anxiolytic utilization vs. demographic benchmark; TRD-pattern signals raise it.', evidence: 'CDC/NCHS Data Brief 377 (13.2% of US adults on antidepressants); TRD cost studies; AD→depression attribution ~0.65 (Gardarsdottir et al.; PMID 30680859).' },
  { label: '2. Unmet-need gap (flagship)', logic: 'High comorbidity shadow with LOW behavioral utilization/spend. Low BH% of spend is scored as risk when the shadow is high, never as reassurance.', evidence: 'Milliman 2020: 27% of members drive 56.5% of spend while only 4.4% goes to BH treatment; under-detection literature (Fiest 2014).' },
  { label: '3. Stress-linked comorbidity shadow', logic: 'Weighted presence/rank of MSK-pain, sleep, migraine, GI, cardiometabolic in top diagnosis categories; ER utilization above benchmark adds weight.', evidence: 'Undiagnosed mood disorder in chronic pain populations (PMID 23742219); depression × chronic disease cost multiplication (PMID 19687180; Egede).' },
  { label: '4. Clinical-severity flags', logic: 'Psych inpatient/behavioral ER events, SUD claims, BH high-cost claimants, MH disability claims. Any hit routes to the referral section regardless of other scores.', evidence: 'Treatment effectiveness literature; ~4:1 productivity return on scaled depression/anxiety treatment (Chisholm 2016, WHO).' },
];

// ── Display helpers ───────────────────────────────────────────────────────

export function formatFieldValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'percent': {
      const n = Number(value);
      return isFinite(n) ? `${(n * 100).toFixed(1).replace(/\.0$/, '')}%` : '—';
    }
    case 'currency': {
      const n = Number(value);
      return isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '—';
    }
    case 'yn':
      return value === 'Y' ? 'Yes' : value === 'N' ? 'No' : '—';
    default:
      return String(value);
  }
}

export function fieldByKey(key) {
  for (const block of CLAIMS_BLOCKS) {
    const f = block.fields.find(x => x.key === key);
    if (f) return f;
  }
  return null;
}
