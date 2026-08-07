/**
 * Quick Builder pricing engine.
 *
 * SOURCE OF TRUTH: "SkillfulMeans_Revenue_Proforma" (Google Sheets), Rate Card tab.
 * Every constant below is copied from that workbook. If a price changes there,
 * change it here — the Proforma's Proforma tab (section 1, Unit Economics by
 * Company Size) is the regression test. See verifyPricing() at the bottom.
 *
 * Confirmed with William 2026-08-07:
 *   · Workshop sessions scale PER TOPIC: $1,500 first + $1,200 each extra.
 *   · Leadership EQ uses the scaled formula, not the old flat $10,000.
 *   · Wellness boxes are included in the tier price at the $100 blended rate.
 *   · Two $300 adjustments: new-client welcome, or returning-client materials
 *     credit (the recording + materials are only ever sent once).
 */

// ── Rate card (Proforma → Rate Card tab) ───────────────────────────────────
export const RATE_CARD = {
  // Workshops
  workshopFirstSession: 1500,   // includes recording + materials
  workshopExtraSession: 1200,   // = first session − $300 materials component
  materialsComponent: 300,      // sent once only
  attendanceRate: 0.25,         // % of employees who show up
  maxAttendeesPerSession: 250,  // engagement cap
  // → 250 / 25% = 1,000 employees per session

  // Challenges
  challengeEngagementRate: 0.20, // share of headcount given slots
  challengeMinSlots: 40,

  // Leadership EQ
  leqSeries: 10000,             // three-workshop series, flat
  leqCoachingRatePerHour: 1200, // per group, per hour
  leqCoachingHours: 3,
  leqMaxLeadersPerGroup: 12,
  leqLcpPerLeader: 1250,        // assessment + individual session
  leqLeaderRate: 0.005,         // 0.50% of headcount are leaders

  // Wellness boxes
  wellnessBox: 100,             // blended average (brochure range $40–$300)

  // Adjustments
  newClientWelcome: 300,
  returningClientMaterialsCredit: 300,

  // Quoted separately, never auto-added (Proforma: "NOT included in the package math")
  inPersonTravelAddOn: 500,
};

export const ROI_CALCULATOR_URL = 'https://skillfulmeans-roi-production.up.railway.app/';

// TODO(William): point this at the public brochure PDF. Falls back to the
// in-app service catalog until then.
export const BROCHURE_URL = '/ServiceCatalog';

// ── Challenge volume tiers (Proforma → Rate Card, mirrors ChallengePricingEstimator) ──
export const CHALLENGE_TIERS = [
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
];

// ── The 6 tiers ────────────────────────────────────────────────────────────
// Composition mirrors the Proforma's Packages tab and the ROI Engine's stages.
//
// leaderRate: stages 1–4 use the Proforma's 0.50%. Stages 5 and 6 sell a wider
// cascade ("group coaching across the organization", "individual + group
// coaching") which the Proforma does not price separately, so they scale the
// leader rate instead — 1.0% and 1.5%. Approved by William 2026-08-07 as
// working numbers; revisit once those two tiers are defined in the Proforma.
export const CAMPAIGN_STAGES = [
  {
    stage: 1,
    name: 'Foundation',
    tagline: 'Get everyone speaking the same language.',
    intent: 'Establish shared mental fitness language and lock initial skills into daily habit.',
    workshops: 2, challenges: 1, leadershipEQ: false,
    groupCoaching: false, individualCoaching: false,
    wellnessBoxes: 3,
  },
  {
    stage: 2,
    name: 'Habit',
    tagline: 'Turn the language into daily practice.',
    intent: 'Deepen practice with more workshops and challenges to build lasting habits across the team.',
    workshops: 4, challenges: 2, leadershipEQ: false,
    groupCoaching: false, individualCoaching: false,
    wellnessBoxes: 18,
  },
  {
    stage: 3,
    name: 'Resilience',
    tagline: 'Bring leaders into it.',
    intent: 'Add Leadership EQ to build team resilience and emotional intelligence.',
    workshops: 2, challenges: 2, leadershipEQ: true,
    groupCoaching: false, individualCoaching: false,
    wellnessBoxes: 12,
    leaderRate: 0.005,
  },
  {
    stage: 4,
    name: 'Alignment',
    tagline: 'Align the whole organization.',
    intent: 'Scale up workshops with Leadership EQ to align teams and culture.',
    workshops: 4, challenges: 2, leadershipEQ: true,
    groupCoaching: false, individualCoaching: false,
    wellnessBoxes: 18,
    leaderRate: 0.005,
  },
  {
    stage: 5,
    name: 'Culture Shift',
    tagline: 'Cascade the skills through every layer.',
    intent: 'Add group coaching to cascade skills across the entire organization.',
    workshops: 4, challenges: 2, leadershipEQ: true,
    groupCoaching: true, individualCoaching: false,
    wellnessBoxes: 18,
    leaderRate: 0.010, // 2× the Proforma rate — the cascade reaches more leaders
  },
  {
    stage: 6,
    name: 'Ecosystem',
    tagline: 'Full-spectrum support, top to bottom.',
    intent: 'Full-spectrum support with individual and group coaching for organization-wide transformation.',
    workshops: 4, challenges: 4, leadershipEQ: true,
    groupCoaching: true, individualCoaching: true,
    wellnessBoxes: 24,
    leaderRate: 0.015, // 3× the Proforma rate — individual + group coaching org-wide
  },
];

// ── Component calculators ──────────────────────────────────────────────────

/** Sessions needed per workshop topic: one per 1,000 employees, always ≥ 1. */
export function sessionsPerWorkshop(headcount) {
  const hc = Number(headcount) || 0;
  const perSession = RATE_CARD.maxAttendeesPerSession / RATE_CARD.attendanceRate; // 1,000
  return Math.max(1, Math.ceil(hc / perSession));
}

/** Price for ONE workshop topic delivered to the whole company. */
export function workshopTopicPrice(headcount) {
  const sessions = sessionsPerWorkshop(headcount);
  return RATE_CARD.workshopFirstSession + (sessions - 1) * RATE_CARD.workshopExtraSession;
}

/** Challenge slots offered: 20% of headcount, floor of 40. */
export function challengeSlots(headcount) {
  const hc = Number(headcount) || 0;
  return Math.max(RATE_CARD.challengeMinSlots, Math.round(hc * RATE_CARD.challengeEngagementRate));
}

/** Per-person rate for a given slot count. */
export function challengeRatePerPerson(slots) {
  const tier = CHALLENGE_TIERS.find(t => slots >= t.min && slots <= t.max);
  return tier ? tier.price : CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].price;
}

/**
 * KNOWN RATE-CARD ANOMALY — the banded challenge table is not monotonic.
 * At the top of every band, a company pays MORE than a slightly larger company
 * at the entry of the next band. Worst cases: 2,495 employees pay $5,988 per
 * challenge while 2,500 pay $5,000; 4,995 pay $9,990 while 5,000 pay $9,000.
 * This exists in the Proforma's Rate Card and in the live
 * ChallengePricingEstimator — it is not introduced here.
 *
 * ON (William, 2026-08-07): each challenge is capped at the cheapest entry
 * price of any larger band. Price now never falls as headcount rises. This
 * leaves all five Proforma unit-economics bands untouched — it only trims the
 * tail of each band, costing at most ~$990 per challenge for a company sitting
 * just under a boundary.
 *
 * If you ever set this back to false, quotes reproduce the Proforma exactly,
 * cliffs included.
 */
export const SMOOTH_CHALLENGE_BANDS = true;

/** Price for ONE 14-day challenge. */
export function challengePrice(headcount) {
  const slots = challengeSlots(headcount);
  const raw = slots * challengeRatePerPerson(slots);
  if (!SMOOTH_CHALLENGE_BANDS) return raw;
  const cheaperUpBand = CHALLENGE_TIERS
    .filter(t => t.min > slots)
    .map(t => t.min * t.price);
  return Math.min(raw, ...cheaperUpBand.length ? cheaperUpBand : [raw]);
}

/** Leadership EQ program price + its moving parts, scaled to headcount. */
export function leadershipEqPrice(headcount, leaderRate = RATE_CARD.leqLeaderRate) {
  const hc = Number(headcount) || 0;
  const leaders = Math.max(1, Math.ceil(hc * leaderRate));
  const groups = Math.max(1, Math.ceil(leaders / RATE_CARD.leqMaxLeadersPerGroup));
  const coaching = RATE_CARD.leqCoachingRatePerHour * RATE_CARD.leqCoachingHours * groups;
  const lcp = RATE_CARD.leqLcpPerLeader * leaders;
  return { total: RATE_CARD.leqSeries + coaching + lcp, leaders, groups, series: RATE_CARD.leqSeries, coaching, lcp };
}

// ── Full quote ─────────────────────────────────────────────────────────────

/**
 * Build a complete, line-itemed quote for one tier at one headcount.
 *
 * @param {object} opts
 * @param {number}  opts.headcount     — exact employee count
 * @param {number}  opts.stage         — 1–6
 * @param {boolean} opts.isNewClient   — apply the $300 welcome discount
 * @param {boolean} opts.isReturningClient — apply the $300 materials credit
 */
export function computeQuote({ headcount, stage = 1, isNewClient = false, isReturningClient = false }) {
  const hc = Number(headcount) || 0;
  const tier = CAMPAIGN_STAGES.find(s => s.stage === stage) || CAMPAIGN_STAGES[0];

  const sessions = sessionsPerWorkshop(hc);
  const perTopic = workshopTopicPrice(hc);
  const workshopTotal = tier.workshops * perTopic;

  const slots = challengeSlots(hc);
  const perPerson = challengeRatePerPerson(slots);
  // Always go through challengePrice() — it is the single place the band rules
  // (and the SMOOTH_CHALLENGE_BANDS cap) are applied.
  const perChallenge = challengePrice(hc);
  const challengeTotal = tier.challenges * perChallenge;

  const leq = tier.leadershipEQ ? leadershipEqPrice(hc, tier.leaderRate) : null;
  const leadershipTotal = leq ? leq.total : 0;

  const boxTotal = tier.wellnessBoxes * RATE_CARD.wellnessBox;

  const subtotal = workshopTotal + challengeTotal + leadershipTotal + boxTotal;

  const discounts = [];
  if (isNewClient) {
    discounts.push({ label: 'First-time client welcome', amount: RATE_CARD.newClientWelcome });
  }
  if (isReturningClient) {
    discounts.push({ label: 'Returning client — materials already sent', amount: RATE_CARD.returningClientMaterialsCredit });
  }
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

  return {
    tier,
    headcount: hc,
    subtotal,
    discounts,
    discountTotal,
    total: Math.max(0, subtotal - discountTotal),
    lines: [
      {
        key: 'workshops',
        label: `${tier.workshops} workshop${tier.workshops !== 1 ? 's' : ''}`,
        detail: sessions > 1
          ? `${sessions} sessions each (1 per 1,000 employees) — $${RATE_CARD.workshopFirstSession.toLocaleString()} first + $${RATE_CARD.workshopExtraSession.toLocaleString()} × ${sessions - 1} = $${perTopic.toLocaleString()} per topic`
          : `$${perTopic.toLocaleString()} each, one session covers your team`,
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
        detail: `$${leq.series.toLocaleString()} series + $${leq.coaching.toLocaleString()} group coaching (${leq.groups} group${leq.groups !== 1 ? 's' : ''} × ${RATE_CARD.leqCoachingHours} hrs) + $${leq.lcp.toLocaleString()} LCP assessments (${leq.leaders} leader${leq.leaders !== 1 ? 's' : ''})`,
        amount: leadershipTotal,
      }] : []),
      {
        key: 'boxes',
        label: `${tier.wellnessBoxes} wellness box${tier.wellnessBoxes !== 1 ? 'es' : ''}`,
        detail: `$${RATE_CARD.wellnessBox} each (blended average)`,
        amount: boxTotal,
      },
    ],
    meta: { sessionsPerWorkshop: sessions, workshopTopicPrice: perTopic, challengeSlots: slots, challengeRatePerPerson: perPerson, challengePrice: perChallenge, leq },
  };
}

/**
 * Lowest tier whose composition covers the given selections. Used by
 * EditProposal to label a hand-built proposal with its closest tier.
 * Returns the top tier when nothing covers.
 */
export function findMatchedStage({ workshopCount = 0, challengeCount = 0, hasLeadership = false }) {
  for (const stage of CAMPAIGN_STAGES) {
    if (
      stage.workshops >= workshopCount &&
      stage.challenges >= challengeCount &&
      (!hasLeadership || stage.leadershipEQ)
    ) {
      return stage;
    }
  }
  return CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1];
}

/** "Stage N — Name" */
export function formatStageLabel(stage) {
  if (!stage) return '';
  return `Stage ${stage.stage} — ${stage.name}`;
}

/** Human-readable composition of a tier. */
export function formatComposition(stage) {
  if (!stage) return '';
  const parts = [
    `${stage.workshops} workshop${stage.workshops !== 1 ? 's' : ''}`,
    `${stage.challenges} challenge${stage.challenges !== 1 ? 's' : ''}`,
  ];
  if (stage.leadershipEQ) parts.push('Leadership EQ');
  if (stage.groupCoaching) parts.push('group coaching');
  if (stage.individualCoaching) parts.push('individual coaching');
  parts.push(`${stage.wellnessBoxes} wellness box${stage.wellnessBoxes !== 1 ? 'es' : ''}`);
  return parts.join(' · ');
}

/** Resolve a company-size value (number or legacy range string) to a headcount. */
export function resolveHeadcount(companySize) {
  if (!companySize) return 0;
  const str = String(companySize).replace(/[,\s]/g, '');
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const map = { '1-50': 50, '51-200': 150, '201-500': 300, '501-1000': 750, '1001-5000': 2000, '5000+': 5000 };
  return map[String(companySize).trim()] || 0;
}

/** Legacy band string for a headcount — kept so older records stay comparable. */
export function headcountToBand(headcount) {
  const hc = Number(headcount) || 0;
  if (hc <= 50) return '1-50';
  if (hc <= 200) return '51-200';
  if (hc <= 500) return '201-500';
  if (hc <= 1000) return '501-1000';
  if (hc <= 5000) return '1001-5000';
  return '5000+';
}

/**
 * Regression check against the Proforma's "1 · UNIT ECONOMICS BY COMPANY SIZE"
 * table. Returns [] when every band matches. Run from a test or the console.
 */
export function verifyPricing() {
  const expected = [
    { headcount: 200,  sessions: 1, workshop: 1500, challenge: 1080, leq: 14850 },
    { headcount: 500,  sessions: 1, workshop: 1500, challenge: 2200, leq: 17350 },
    { headcount: 1000, sessions: 1, workshop: 1500, challenge: 3600, leq: 19850 },
    { headcount: 2000, sessions: 2, workshop: 2700, challenge: 4800, leq: 26100 },
    { headcount: 4000, sessions: 4, workshop: 5100, challenge: 8000, leq: 42200 },
  ];
  const failures = [];
  for (const row of expected) {
    const s = sessionsPerWorkshop(row.headcount);
    const w = workshopTopicPrice(row.headcount);
    const c = challengePrice(row.headcount);
    const l = leadershipEqPrice(row.headcount).total;
    if (s !== row.sessions) failures.push(`${row.headcount}: sessions ${s} ≠ ${row.sessions}`);
    if (w !== row.workshop) failures.push(`${row.headcount}: workshop ${w} ≠ ${row.workshop}`);
    if (c !== row.challenge) failures.push(`${row.headcount}: challenge ${c} ≠ ${row.challenge}`);
    if (l !== row.leq) failures.push(`${row.headcount}: leadership EQ ${l} ≠ ${row.leq}`);
  }
  return failures;
}
