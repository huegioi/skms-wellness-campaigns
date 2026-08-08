/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE RATE CARD — the single source of truth for every SkillfulMeans price.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * SOURCE: "SkillfulMeans_Revenue_Proforma" (Google Sheets) → Rate Card tab.
 *
 * This file is imported directly by BOTH runtimes:
 *   · Deno backend functions —  import { ... } from '../../shared/rateCard.ts'
 *   · React frontend         —  import { ... } from '@/lib/rateCard'
 *     (src/lib/rateCard.js re-exports this file, so Vite bundles it)
 *
 * There are no mirrors of this file. If you find a price hard-coded anywhere
 * else in the codebase, that is a bug — route it through here instead.
 *
 * ── CHANGING A PRICE ──────────────────────────────────────────────────────
 * 1. Change it in the Proforma first. The Proforma is the business document;
 *    this file is its executable form.
 * 2. Change the constant below.
 * 3. Update the expectations in verifyRateCard() to match the Proforma's
 *    "1 · UNIT ECONOMICS BY COMPANY SIZE" table.
 * 4. Run the drift test (npm run check:pricing). It fails if any engine in
 *    the app disagrees with this file.
 *
 * Decisions confirmed by William, 2026-08-07 — do not "correct" these:
 *   · Workshop sessions scale PER TOPIC, one session per 1,000 employees.
 *   · Leadership EQ scales with headcount; it is NOT a flat $10,000.
 *   · Wellness boxes are included in a tier's price at the blended rate.
 *
 * ── TWO DIFFERENT $300s. DO NOT CONFLATE THEM ─────────────────────────────
 * They are the same number by coincidence and were confused once already.
 *
 *   1. materialsComponent ($300) — NOT a discount, and nothing to do with
 *      the client. The recording and printed materials are produced once per
 *      workshop TOPIC, so the first section costs $1,500 and every extra
 *      section of that same topic costs $1,200. A large company running
 *      Beyond Burnout across 4 sections, so staff have a choice of times,
 *      pays $1,500 + $1,200 x 3 — not $1,500 x 4. Already expressed by
 *      workshopExtraSession; never apply it as a separate line.
 *
 *   2. newClientWelcome ($300) — a real sales discount, taken off the total
 *      once, for a company's FIRST campaign with SkillfulMeans. Confirmed by
 *      William 2026-08-08.
 *
 *   There is NO "materials credit" for returning clients. That idea was
 *   removed on 2026-08-08 as incoherent — returning clients do not get $300
 *   off for having worked with us before.
 */

// ── Prices ────────────────────────────────────────────────────────────────
//
// RATE_CARD_DEFAULTS is what ships in the code. RATE_CARD below starts as a
// copy and is the object everything actually reads. The Rate Card admin page
// saves overrides to the RateCardSetting record; applyRateCardOverrides()
// merges them in at startup, so a saved price takes effect everywhere without
// anything having to re-import.
export const RATE_CARD_DEFAULTS = {
  // Workshops
  workshopFirstSession: 1500,   // includes recording + materials
  workshopExtraSession: 1200,   // = first session − the $300 materials component
  // Produced once per workshop TOPIC — this is why an extra section is
  // $1,200 rather than $1,500. It is not a discount. See the header note.
  materialsComponent: 300,
  attendanceRate: 0.25,         // share of employees who show up
  maxAttendeesPerSession: 250,  // engagement cap → 1,000 employees per session

  // 14-day challenges
  challengeEngagementRate: 0.20, // share of headcount given slots
  challengeMinSlots: 40,

  // Leadership EQ
  leqSeries: 10000,             // three-workshop series, flat
  leqCoachingRatePerHour: 1200, // per group, per hour
  leqCoachingHours: 3,          // hours in one coaching block
  leqMaxLeadersPerGroup: 12,
  leqLcpPerLeader: 1250,        // LCP assessment + individual session
  leqLeaderRate: 0.005,         // 0.50% of headcount are leaders

  // Leadership EQ — individual components.
  // The $10,000 series is a bundle: sold separately the three workshops come
  // to $10,500, so the series carries a $500 bundle discount. Both are real.
  leqSingleWorkshop: 3500,      // one of the three series workshops, sold alone
  leqCoachingSession: 450,      // Leadership EQ Coaching Program, per session

  // Wellness boxes
  wellnessBox: 100,             // blended average across the brochure range
  // Boxes are handed out at each delivery, so the count is DERIVED, not a
  // number typed per tier: 3 for every workshop section and 3 for every
  // challenge. Confirmed by William 2026-08-08. Five of the six tiers already
  // matched this exactly; Foundation had 3 where the rule gives 9, which was
  // a slip in the Proforma.
  boxesPerWorkshopSection: 3,
  boxesPerChallenge: 3,

  // Adjustments
  // A genuine sales discount: a company's first campaign with us. Distinct
  // from materialsComponent above, which happens to be the same amount.
  newClientWelcome: 300,

  // Quoted separately, never auto-added
  // (Proforma: "NOT included in the package math — add manually when it applies")
  inPersonTravelAddOn: 500,
};

/** The live rate card. Mutated in place by applyRateCardOverrides(). */
export const RATE_CARD: Record<string, number> = { ...RATE_CARD_DEFAULTS };

export const CHALLENGE_TIER_DEFAULTS = () => ([
  { min: 40,   max: 49,       price: 27 },
  { min: 50,   max: 59,       price: 25 },
  { min: 60,   max: 99,       price: 24 },
  { min: 100,  max: 149,      price: 22 },
  { min: 150,  max: 199,      price: 20 },
  { min: 200,  max: 249,      price: 18 },
  { min: 250,  max: 299,      price: 15 },
  { min: 300,  max: 349,      price: 14 },
  { min: 350,  max: 399,      price: 13 },
  { min: 400,  max: 499,      price: 12 },
  { min: 500,  max: 999,      price: 10 },
  { min: 1000, max: Infinity, price: 9  },
]);

export const WELLNESS_BOX_DEFAULTS = {
  reduceStress: 65,
  relaxationSleep: 65,
  largeEmotional: 100,
  largeStressReduction: 120,
  stressReductionDigital: 50,
  beyondBurnoutDigital: 100,
  emotionalWellness: 100,
  wintertimeHealthy: 100,
  newYearFreshStart: 100,
};

export const CLASS_PRICE_DEFAULTS = {
  mindfulMovement: 2000,
  yogaStress: 2000,
  mindfulnessClasses: 1800,
};

export const ROI_CALCULATOR_URL = 'https://skillfulmeans-roi-production.up.railway.app/';
export const BROCHURE_URL = 'https://canva.link/74cztlpziuaeqfs';

// ── Challenge volume bands ────────────────────────────────────────────────
export interface ChallengeTier { min: number; max: number; price: number }

export const CHALLENGE_TIERS: ChallengeTier[] = CHALLENGE_TIER_DEFAULTS();

/**
 * The banded table above is NOT monotonic on its own: at the top of every
 * band a company pays more than a slightly larger company at the entry of the
 * next band (2,495 employees → $5,988 per challenge; 2,500 → $5,000). Eleven
 * such cliffs exist. Capping each challenge at the cheapest entry price of any
 * larger band removes them without touching any Proforma size band.
 * ON since 2026-08-07 (William).
 */
export const SMOOTH_CHALLENGE_BANDS = true;

// ── Wellness box SKUs ─────────────────────────────────────────────────────
// Per-box prices. RATE_CARD.wellnessBox is the BLENDED average used for tier
// quoting; these are the individual SKUs used when a specific box is chosen.
export const WELLNESS_BOX_PRICES: Record<string, number> = { ...WELLNESS_BOX_DEFAULTS };

/** Box key → wellness_box Service record name, for live price lookup. */
export const BOX_KEY_TO_SERVICE_NAME: Record<string, string> = {
  reduceStress: 'Reduce Stress Wellness Box',
  relaxationSleep: 'Relaxation & Sleep Wellness Box',
  largeEmotional: 'Large Emotional Wellness Box',
  largeStressReduction: 'Large Stress Reduction Wellness Box',
  stressReductionDigital: 'Stress Reduction Digital Wellness Box',
  beyondBurnoutDigital: 'Beyond Burnout Digital Wellness Box',
  emotionalWellness: 'Emotional Wellness Box',
  wintertimeHealthy: 'Wintertime Stay Healthy Box',
  newYearFreshStart: 'New Year Fresh Start Box',
};

/** Presentation labels. NOT Service record names — don't derive one from the other. */
export const BOX_DISPLAY_NAMES: Record<string, string> = {
  reduceStress: 'Reduce Stress Box',
  relaxationSleep: 'Relaxation & Sleep Box',
  largeEmotional: 'Large Emotional Wellness Box',
  largeStressReduction: 'Large Stress Reduction Box',
  stressReductionDigital: 'Stress Reduction Digital Box',
  beyondBurnoutDigital: 'Beyond Burnout Digital Box',
  emotionalWellness: 'Emotional Wellness Box',
  wintertimeHealthy: 'Wintertime Stay Healthy Box',
  newYearFreshStart: 'New Year Fresh Start Box',
};

// ── Movement & mindfulness classes ────────────────────────────────────────
// Flat per-series prices; these do not scale with headcount.
export const CLASS_PRICES: Record<string, number> = { ...CLASS_PRICE_DEFAULTS };

export const MIN_PHYSICAL_BOX_PRICE = 65;
export const MIN_DIGITAL_BOX_PRICE = 50;
export const DIGITAL_BOX_KEYS = ['stressReductionDigital', 'beyondBurnoutDigital'];

/** Never let a box price fall below its floor, whatever the source. */
export function applyBoxFloor(key: string, price: number): number {
  const floor = DIGITAL_BOX_KEYS.includes(key) ? MIN_DIGITAL_BOX_PRICE : MIN_PHYSICAL_BOX_PRICE;
  return Math.max(floor, Number(price) || 0);
}

// ── The six campaign tiers ────────────────────────────────────────────────
// Composition mirrors the Proforma's Packages tab.
//
// Wellness box counts are NOT listed per tier — they are derived from what
// the tier delivers: RATE_CARD.boxesPerWorkshopSection for every workshop
// section, plus RATE_CARD.boxesPerChallenge for every challenge. Workshops
// multiply by sections; challenges do not, because one challenge covers the
// whole company through its slot count. See boxCountFor() below.
//
// Leader participation is 0.50% on every tier. Tiers 5 and 6 add more
// DELIVERY per leader rather than more leaders:
//   coachingBlocks — 3-hour group coaching blocks per group of 12.
//   lcpRounds      — LCP assessment + 1:1 rounds per leader.
export interface CampaignStage {
  stage: number;
  name: string;
  tagline: string;
  intent: string;
  workshops: number;
  challenges: number;
  leadershipEQ: boolean;
  groupCoaching: boolean;
  individualCoaching: boolean;
  coachingBlocks?: number;
  lcpRounds?: number;
}

export const CAMPAIGN_STAGES: CampaignStage[] = [
  {
    stage: 1,
    name: 'Foundation',
    tagline: 'Get everyone speaking the same language.',
    intent: 'Establish shared mental fitness language and lock initial skills into daily habit.',
    workshops: 2, challenges: 1, leadershipEQ: false,
    groupCoaching: false, individualCoaching: false,
  },
  {
    stage: 2,
    name: 'Habit',
    tagline: 'Turn the language into daily practice.',
    intent: 'Deepen practice with more workshops and challenges to build lasting habits across the team.',
    workshops: 4, challenges: 2, leadershipEQ: false,
    groupCoaching: false, individualCoaching: false,
  },
  {
    stage: 3,
    name: 'Resilience',
    tagline: 'Bring leaders into it.',
    intent: 'Add Leadership EQ to build team resilience and emotional intelligence.',
    workshops: 2, challenges: 2, leadershipEQ: true,
    groupCoaching: false, individualCoaching: false,
    coachingBlocks: 1, lcpRounds: 1,
  },
  {
    stage: 4,
    name: 'Alignment',
    tagline: 'Align the whole organization.',
    intent: 'Scale up workshops with Leadership EQ to align teams and culture.',
    workshops: 4, challenges: 2, leadershipEQ: true,
    groupCoaching: false, individualCoaching: false,
    coachingBlocks: 1, lcpRounds: 1,
  },
  {
    stage: 5,
    name: 'Culture Shift',
    tagline: 'Cascade the skills through every layer.',
    intent: 'Add group coaching to cascade skills across the entire organization.',
    workshops: 4, challenges: 2, leadershipEQ: true,
    groupCoaching: true, individualCoaching: false,
    coachingBlocks: 2, lcpRounds: 1,
  },
  {
    stage: 6,
    name: 'Ecosystem',
    tagline: 'Full-spectrum support, top to bottom.',
    intent: 'Full-spectrum support with individual and group coaching for organization-wide transformation.',
    workshops: 4, challenges: 4, leadershipEQ: true,
    groupCoaching: true, individualCoaching: true,
    coachingBlocks: 2, lcpRounds: 2,
  },
];

// ── Component calculators ─────────────────────────────────────────────────

/** Sessions needed per workshop TOPIC: one per 1,000 employees, always >= 1. */
export function sessionsPerWorkshop(headcount: number): number {
  const hc = Number(headcount) || 0;
  const perSession = RATE_CARD.maxAttendeesPerSession / RATE_CARD.attendanceRate; // 1,000
  return Math.max(1, Math.ceil(hc / perSession));
}

/** Price for ONE workshop topic delivered to the whole company. */
export function workshopTopicPrice(headcount: number): number {
  const sessions = sessionsPerWorkshop(headcount);
  return RATE_CARD.workshopFirstSession + (sessions - 1) * RATE_CARD.workshopExtraSession;
}

/** Challenge slots offered: 20% of headcount, floor of 40. */
export function challengeSlots(headcount: number): number {
  const hc = Number(headcount) || 0;
  return Math.max(RATE_CARD.challengeMinSlots, Math.round(hc * RATE_CARD.challengeEngagementRate));
}

/** Per-person rate for a given slot count. */
export function challengeRatePerPerson(slots: number): number {
  const tier = CHALLENGE_TIERS.find(t => slots >= t.min && slots <= t.max);
  return tier ? tier.price : CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].price;
}

/**
 * Price for ONE 14-day challenge. This is the ONLY place the band rules and
 * the monotonicity cap are applied — never recompute slots × rate inline.
 */
export function challengePrice(headcount: number): number {
  const slots = challengeSlots(headcount);
  const raw = slots * challengeRatePerPerson(slots);
  if (!SMOOTH_CHALLENGE_BANDS) return raw;
  const cheaperUpBand = CHALLENGE_TIERS.filter(t => t.min > slots).map(t => t.min * t.price);
  return cheaperUpBand.length ? Math.min(raw, ...cheaperUpBand) : raw;
}

/**
 * Wellness boxes for a tier at a given headcount.
 * 3 per workshop SECTION + 3 per challenge.
 */
export function boxCountFor(
  tier: { workshops: number; challenges: number },
  headcount: number,
): number {
  const sections = sessionsPerWorkshop(headcount);
  return RATE_CARD.boxesPerWorkshopSection * tier.workshops * sections
       + RATE_CARD.boxesPerChallenge * tier.challenges;
}

export interface LeadershipEqBreakdown {
  total: number; leaders: number; groups: number;
  coachingBlocks: number; lcpRounds: number; coachingHours: number;
  series: number; coaching: number; lcp: number;
}

/**
 * Leadership EQ program price and its parts, scaled to headcount.
 * Defaults (1 coaching block, 1 LCP round) reproduce the Proforma exactly.
 */
export function leadershipEqPrice(
  headcount: number,
  opts: { coachingBlocks?: number; lcpRounds?: number } = {},
): LeadershipEqBreakdown {
  const { coachingBlocks = 1, lcpRounds = 1 } = opts;
  const hc = Number(headcount) || 0;
  const leaders = Math.max(1, Math.ceil(hc * RATE_CARD.leqLeaderRate));
  const groups = Math.max(1, Math.ceil(leaders / RATE_CARD.leqMaxLeadersPerGroup));
  const coachingHours = RATE_CARD.leqCoachingHours * coachingBlocks;
  const coaching = RATE_CARD.leqCoachingRatePerHour * coachingHours * groups;
  const lcp = RATE_CARD.leqLcpPerLeader * leaders * lcpRounds;
  return {
    total: RATE_CARD.leqSeries + coaching + lcp,
    leaders, groups, coachingBlocks, lcpRounds, coachingHours,
    series: RATE_CARD.leqSeries, coaching, lcp,
  };
}

// ── Full quote ────────────────────────────────────────────────────────────
export interface QuoteLine { key: string; label: string; detail: string; amount: number }

export function computeQuote(
  { headcount, stage = 1, isNewClient = false }:
  { headcount: number; stage?: number; isNewClient?: boolean },
) {
  const hc = Number(headcount) || 0;
  const tier = CAMPAIGN_STAGES.find(s => s.stage === stage) || CAMPAIGN_STAGES[0];

  const sessions = sessionsPerWorkshop(hc);
  const perTopic = workshopTopicPrice(hc);
  const workshopTotal = tier.workshops * perTopic;

  const slots = challengeSlots(hc);
  const perPerson = challengeRatePerPerson(slots);
  const perChallenge = challengePrice(hc);
  const challengeTotal = tier.challenges * perChallenge;

  const leq = tier.leadershipEQ
    ? leadershipEqPrice(hc, { coachingBlocks: tier.coachingBlocks, lcpRounds: tier.lcpRounds })
    : null;
  const leadershipTotal = leq ? leq.total : 0;

  const boxCount = boxCountFor(tier, hc);
  const boxTotal = boxCount * RATE_CARD.wellnessBox;

  const subtotal = workshopTotal + challengeTotal + leadershipTotal + boxTotal;

  const discounts: { label: string; amount: number }[] = [];
  if (isNewClient) {
    discounts.push({ label: 'First-time client welcome', amount: RATE_CARD.newClientWelcome });
  }
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

  const lines: QuoteLine[] = [
    {
      key: 'workshops',
      label: `${tier.workshops} workshop${tier.workshops !== 1 ? 's' : ''}`,
      detail: sessions > 1
        ? `${sessions} sections each so staff have a choice of times — $${RATE_CARD.workshopFirstSession.toLocaleString()} for the first, then $${RATE_CARD.workshopExtraSession.toLocaleString()} × ${sessions - 1} (materials and the recording are produced once, so each extra section is $${RATE_CARD.materialsComponent} less) = $${perTopic.toLocaleString()} per topic`
        : `$${perTopic.toLocaleString()} each, one section covers your team`,
      amount: workshopTotal,
    },
    {
      key: 'challenges',
      label: `${tier.challenges} 14-day challenge${tier.challenges !== 1 ? 's' : ''}`,
      detail: `${slots.toLocaleString()} slots @ $${perPerson}/person = $${perChallenge.toLocaleString()} each`,
      amount: challengeTotal,
    },
    ...(leq ? [{
      key: 'leadership',
      label: 'Leadership EQ program',
      detail: `$${leq.series.toLocaleString()} series + $${leq.coaching.toLocaleString()} group coaching (${leq.groups} group${leq.groups !== 1 ? 's' : ''} × ${leq.coachingHours} hrs) + $${leq.lcp.toLocaleString()} LCP${leq.lcpRounds > 1 ? ` ×${leq.lcpRounds} rounds` : ''} (${leq.leaders} leader${leq.leaders !== 1 ? 's' : ''})`,
      amount: leadershipTotal,
    }] : []),
    {
      key: 'boxes',
      label: `${boxCount} wellness box${boxCount !== 1 ? 'es' : ''}`,
      detail: sessions > 1
        ? `${RATE_CARD.boxesPerWorkshopSection} per workshop section (${tier.workshops} × ${sessions}) + ${RATE_CARD.boxesPerChallenge} per challenge, $${RATE_CARD.wellnessBox} each`
        : `${RATE_CARD.boxesPerWorkshopSection} per workshop + ${RATE_CARD.boxesPerChallenge} per challenge, $${RATE_CARD.wellnessBox} each`,
      amount: boxTotal,
    },
  ];

  return {
    tier, headcount: hc, subtotal, discounts, discountTotal,
    total: Math.max(0, subtotal - discountTotal),
    lines,
    meta: {
      sessionsPerWorkshop: sessions, workshopTopicPrice: perTopic,
      challengeSlots: slots, challengeRatePerPerson: perPerson,
      challengePrice: perChallenge, leq, boxCount,
    },
  };
}

// ── Labels and helpers ────────────────────────────────────────────────────

/** Lowest tier whose composition covers the given selections. */
export function findMatchedStage(
  { workshopCount = 0, challengeCount = 0, hasLeadership = false }:
  { workshopCount?: number; challengeCount?: number; hasLeadership?: boolean },
): CampaignStage {
  for (const stage of CAMPAIGN_STAGES) {
    if (
      stage.workshops >= workshopCount &&
      stage.challenges >= challengeCount &&
      (!hasLeadership || stage.leadershipEQ)
    ) return stage;
  }
  return CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1];
}

export function formatStageLabel(stage: CampaignStage | null | undefined): string {
  if (!stage) return '';
  return `Stage ${stage.stage} — ${stage.name}`;
}

export function formatComposition(stage: CampaignStage | null | undefined): string {
  if (!stage) return '';
  const parts = [
    `${stage.workshops} workshop${stage.workshops !== 1 ? 's' : ''}`,
    `${stage.challenges} challenge${stage.challenges !== 1 ? 's' : ''}`,
  ];
  if (stage.leadershipEQ) parts.push('Leadership EQ');
  if (stage.groupCoaching) parts.push('group coaching');
  if (stage.individualCoaching) parts.push('individual coaching');
  parts.push(`${RATE_CARD.boxesPerWorkshopSection} wellness boxes per workshop section + ${RATE_CARD.boxesPerChallenge} per challenge`);
  return parts.join(' · ');
}

/** Resolve a company-size value (number or legacy range string) to a headcount. */
export function resolveHeadcount(companySize: string | number | null | undefined): number {
  if (!companySize) return 0;
  const str = String(companySize).replace(/[,\s]/g, '');
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const map: Record<string, number> = {
    '1-50': 50, '51-200': 150, '201-500': 300,
    '501-1000': 750, '1001-5000': 2000, '5000+': 5000,
  };
  return map[String(companySize).trim()] || 0;
}

/** Legacy band string for a headcount. */
export function headcountToBand(headcount: number): string {
  const hc = Number(headcount) || 0;
  if (hc <= 50) return '1-50';
  if (hc <= 200) return '51-200';
  if (hc <= 500) return '201-500';
  if (hc <= 1000) return '501-1000';
  if (hc <= 5000) return '1001-5000';
  return '5000+';
}

// ── Regression against the Proforma ───────────────────────────────────────

/**
 * Checks this rate card against the Proforma's "1 · UNIT ECONOMICS BY COMPANY
 * SIZE" and "2 · PER-CLIENT ECONOMICS" tables. Returns [] when everything
 * matches. Any change to a price above must be reflected here.
 */
export function priceForCatalogItem(
  category: string,
  key: string,
  headcount: number,
): number | null {
  const hc = Number(headcount) || 0;

  // Headcount-dependent items cannot be priced without a headcount. Returning
  // null forces the caller to ask for one instead of quoting a wrong default —
  // this is exactly how the old $1,500 challenge fallback slipped into
  // customer-facing proposals.
  const NEEDS_HEADCOUNT = ['workshops', 'challenges', 'challengePrograms'];
  if (hc <= 0 && (NEEDS_HEADCOUNT.includes(category) ||
      (category === 'leadership' && key === 'leadershipProgram'))) {
    return null;
  }

  switch (category) {
    case 'workshops':
      return workshopTopicPrice(hc);
    case 'challenges':
    case 'challengePrograms':
      return challengePrice(hc);
    case 'leadership':
      if (key === 'leadershipProgram') return leadershipEqPrice(hc).total;
      if (key === 'coachingProgram') return RATE_CARD.leqCoachingSession;
      if (/^workshop[123]$/.test(key)) return RATE_CARD.leqSingleWorkshop;
      return null;
    case 'movementClasses':
    case 'classes':
      return CLASS_PRICES[key] ?? null;
    case 'wellnessBoxes':
    case 'boxes':
      return key in WELLNESS_BOX_PRICES ? applyBoxFloor(key, WELLNESS_BOX_PRICES[key]) : null;
    default:
      return null;
  }
}

export function verifyRateCard(): string[] {
  const failures: string[] = [];

  // Proforma section 1 — components by company size
  const components = [
    { headcount: 200,  sessions: 1, workshop: 1500, challenge: 1080, leq: 14850 },
    { headcount: 500,  sessions: 1, workshop: 1500, challenge: 2200, leq: 17350 },
    { headcount: 1000, sessions: 1, workshop: 1500, challenge: 3600, leq: 19850 },
    { headcount: 2000, sessions: 2, workshop: 2700, challenge: 4800, leq: 26100 },
    { headcount: 4000, sessions: 4, workshop: 5100, challenge: 8000, leq: 42200 },
  ];
  for (const r of components) {
    const s = sessionsPerWorkshop(r.headcount);
    const w = workshopTopicPrice(r.headcount);
    const c = challengePrice(r.headcount);
    const l = leadershipEqPrice(r.headcount).total;
    if (s !== r.sessions) failures.push(`${r.headcount}: sessions ${s} != ${r.sessions}`);
    if (w !== r.workshop) failures.push(`${r.headcount}: workshop ${w} != ${r.workshop}`);
    if (c !== r.challenge) failures.push(`${r.headcount}: challenge ${c} != ${r.challenge}`);
    if (l !== r.leq) failures.push(`${r.headcount}: leadershipEQ ${l} != ${r.leq}`);
  }

  // Proforma section 2 — Light / Core / Full = stages 1 / 2 / 4
  const packages: Record<number, Record<number, number>> = {
    200:  { 1: 4980,  2: 9960,  4: 24810 },
    500:  { 1: 6100,  2: 12200, 4: 29550 },
    1000: { 1: 7500,  2: 15000, 4: 34850 },
    // 2,000 and 4,000 depart from the Proforma deliberately: boxes now scale
    // per section (William 2026-08-08). 1,000 and under are unchanged.
    //   2,000 s1 10,500->10,800 | s2 22,200->24,000 | s4 48,300->50,100
    //   4,000 s1 18,500->19,400 | s2 38,200->43,600 | s4 80,400->85,800
    2000: { 1: 11700, 2: 23400, 4: 49500 },
    4000: { 1: 20900, 2: 41800, 4: 84000 },
  };
  for (const hc of Object.keys(packages)) {
    for (const st of Object.keys(packages[Number(hc)])) {
      const expected = packages[Number(hc)][Number(st)];
      const got = computeQuote({ headcount: Number(hc), stage: Number(st) }).total;
      if (got !== expected) failures.push(`${hc}/stage${st}: ${got} != ${expected}`);
    }
  }

  // Price must never fall as headcount rises, on any tier.
  for (const stage of CAMPAIGN_STAGES) {
    let prev = -1;
    for (let hc = 1; hc <= 6000; hc += 1) {
      const total = computeQuote({ headcount: hc, stage: stage.stage }).total;
      if (total < prev) {
        failures.push(`stage ${stage.stage}: price drops at headcount ${hc}`);
        break;
      }
      prev = total;
    }
  }

  return failures;
}

// ── Runtime overrides (the Rate Card admin page) ──────────────────────────

export interface RateCardOverrides {
  rates?: Record<string, number>;
  challengeTiers?: { min: number; max: number; price: number }[];
  boxPrices?: Record<string, number>;
  classPrices?: Record<string, number>;
}

/** Everything currently in effect — what the admin page loads for editing. */
export function currentRateCard(): Required<RateCardOverrides> {
  return {
    rates: { ...RATE_CARD },
    challengeTiers: CHALLENGE_TIERS.map(t => ({ ...t })),
    boxPrices: { ...WELLNESS_BOX_PRICES },
    classPrices: { ...CLASS_PRICES },
  };
}

/** The shipped defaults — what "Reset to default" restores. */
export function defaultRateCard(): Required<RateCardOverrides> {
  return {
    rates: { ...RATE_CARD_DEFAULTS },
    challengeTiers: CHALLENGE_TIER_DEFAULTS(),
    boxPrices: { ...WELLNESS_BOX_DEFAULTS },
    classPrices: { ...CLASS_PRICE_DEFAULTS },
  };
}

/**
 * Merge saved overrides into the live rate card, in place, so every module
 * that already imported RATE_CARD sees the new values.
 *
 * Unknown keys and non-finite numbers are ignored rather than trusted — a
 * malformed record must not be able to zero out a price.
 */
export function applyRateCardOverrides(overrides: RateCardOverrides | null | undefined): string[] {
  const applied: string[] = [];
  if (!overrides) return applied;
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);

  for (const [k, v] of Object.entries(overrides.rates || {})) {
    if (!(k in RATE_CARD_DEFAULTS)) continue;
    const n = num(v); if (n === null) continue;
    RATE_CARD[k] = n; applied.push(`rates.${k}`);
  }
  for (const [k, v] of Object.entries(overrides.boxPrices || {})) {
    if (!(k in WELLNESS_BOX_DEFAULTS)) continue;
    const n = num(v); if (n === null) continue;
    WELLNESS_BOX_PRICES[k] = n; applied.push(`box.${k}`);
  }
  for (const [k, v] of Object.entries(overrides.classPrices || {})) {
    if (!(k in CLASS_PRICE_DEFAULTS)) continue;
    const n = num(v); if (n === null) continue;
    CLASS_PRICES[k] = n; applied.push(`class.${k}`);
  }
  const tiers = overrides.challengeTiers;
  if (Array.isArray(tiers) && tiers.length > 0) {
    const clean = tiers
      .map(t => ({ min: Number(t.min), max: t.max === null ? Infinity : Number(t.max), price: Number(t.price) }))
      .filter(t => isFinite(t.min) && t.min >= 0 && t.price >= 0)
      .sort((a, b) => a.min - b.min);
    if (clean.length > 0) {
      CHALLENGE_TIERS.length = 0; CHALLENGE_TIERS.push(...clean); applied.push('challengeTiers');
    }
  }
  return applied;
}

/** Restore the shipped defaults. */
export function resetRateCard(): void {
  Object.assign(RATE_CARD, RATE_CARD_DEFAULTS);
  Object.assign(WELLNESS_BOX_PRICES, WELLNESS_BOX_DEFAULTS);
  Object.assign(CLASS_PRICES, CLASS_PRICE_DEFAULTS);
  CHALLENGE_TIERS.length = 0;
  CHALLENGE_TIERS.push(...CHALLENGE_TIER_DEFAULTS());
}

/**
 * Checks the RAW input from the admin page before it is merged.
 * applyRateCardOverrides deliberately ignores anything malformed, but
 * silently dropping a value the user typed would be worse than refusing it.
 */
export function validateRateCardInput(overrides: RateCardOverrides | null | undefined): string[] {
  const problems: string[] = [];
  if (!overrides) return problems;
  const check = (scope: string, obj: Record<string, unknown> | undefined, known: object) => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (!(k in known)) { problems.push(`${scope}: "${k}" is not a known price`); continue; }
      if (typeof v !== 'number' || !isFinite(v)) { problems.push(`${scope}: "${k}" must be a number`); continue; }
      if (v < 0) problems.push(`${scope}: "${k}" cannot be negative`);
    }
  };
  check('Prices', overrides.rates, RATE_CARD_DEFAULTS);
  check('Wellness boxes', overrides.boxPrices, WELLNESS_BOX_DEFAULTS);
  check('Classes', overrides.classPrices, CLASS_PRICE_DEFAULTS);
  for (const [i, t] of (overrides.challengeTiers || []).entries()) {
    if (!isFinite(Number(t?.min)) || Number(t?.min) < 0) problems.push(`Challenge band ${i + 1}: "from" must be 0 or more`);
    if (!(Number(t?.price) > 0)) problems.push(`Challenge band ${i + 1}: price must be above 0`);
  }
  return problems;
}

/**
 * Rules that must hold for ANY valid rate card, whatever the prices are.
 * Distinct from verifyRateCard(), which checks agreement with the CURRENT
 * Proforma and is expected to fail the moment you deliberately change a price.
 * The admin page refuses to save when this returns anything.
 */
export function verifyRateCardIntegrity(candidate?: RateCardOverrides): string[] {
  const problems: string[] = [];
  const snapshot = currentRateCard();
  if (candidate) applyRateCardOverrides(candidate);
  try {
    for (const [k, v] of Object.entries(RATE_CARD)) {
      if (!isFinite(v) || v < 0) problems.push(`${k} must be a number of 0 or more`);
    }
    if (RATE_CARD.attendanceRate <= 0 || RATE_CARD.attendanceRate > 1) problems.push('attendanceRate must be between 0 and 1 (0.25 = 25%)');
    if (RATE_CARD.challengeEngagementRate <= 0 || RATE_CARD.challengeEngagementRate > 1) problems.push('challengeEngagementRate must be between 0 and 1');
    if (RATE_CARD.leqLeaderRate <= 0 || RATE_CARD.leqLeaderRate > 1) problems.push('leqLeaderRate must be between 0 and 1 (0.005 = 0.5%)');
    if (RATE_CARD.maxAttendeesPerSession < 1) problems.push('maxAttendeesPerSession must be at least 1');
    if (RATE_CARD.leqMaxLeadersPerGroup < 1) problems.push('leqMaxLeadersPerGroup must be at least 1');
    if (RATE_CARD.workshopExtraSession > RATE_CARD.workshopFirstSession) problems.push('a repeat session costs more than the first session — check the workshop prices');

    for (let i = 1; i < CHALLENGE_TIERS.length; i++) {
      if (CHALLENGE_TIERS[i].min <= CHALLENGE_TIERS[i - 1].min) { problems.push(`challenge bands are out of order at band ${i + 1}`); break; }
    }
    for (const t of CHALLENGE_TIERS) {
      if (!(t.price > 0)) { problems.push('every challenge band needs a price above 0'); break; }
    }
    // Volume discount table: per-person price must fall as the group grows.
    for (let i = 1; i < CHALLENGE_TIERS.length; i++) {
      if (CHALLENGE_TIERS[i].price > CHALLENGE_TIERS[i - 1].price) {
        problems.push(`challenge band ${i + 1} (${CHALLENGE_TIERS[i].min}+ slots) costs more per person than the smaller band above it — volume pricing should go down, not up`);
        break;
      }
    }
    for (const stage of CAMPAIGN_STAGES) {
      let prev = -1;
      for (let hc = 1; hc <= 6000; hc += 1) {
        const total = computeQuote({ headcount: hc, stage: stage.stage }).total;
        if (total < prev) { problems.push(`${stage.name}: a company of ${hc} would be quoted less than a smaller one`); break; }
        prev = total;
      }
    }
    for (const hc of [150, 500, 2000, 5000]) {
      const totals = CAMPAIGN_STAGES.map(s => computeQuote({ headcount: hc, stage: s.stage }).total);
      for (let i = 1; i < totals.length; i++) {
        if (totals[i] <= totals[i - 1]) { problems.push(`at ${hc} employees, ${CAMPAIGN_STAGES[i].name} costs no more than ${CAMPAIGN_STAGES[i - 1].name}`); break; }
      }
    }
  } finally {
    if (candidate) { resetRateCard(); applyRateCardOverrides(snapshot); }
  }
  return [...new Set(problems)];
}
