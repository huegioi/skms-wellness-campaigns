/**
 * Stage table + rate card for Quick Builder estimates.
 *
 * MIRRORS the ROI Engine at skillfulmeans-roi-production.up.railway.app — update both together.
 *
 * Stages, rate card, and challenge volume tiers are observed from the ROI Engine.
 * Challenge per-person price tiers match the internal ChallengePricingEstimator
 * (src/components/curriculum/ChallengePricingEstimator.jsx), but the slot-count
 * per headcount differs — the ROI Engine uses a declining slot ratio, not a flat 30%.
 */

// ── Rate card ──────────────────────────────────────────────────────────────
export const RATE_CARD = {
  workshop: 1500,       // per workshop
  leadershipEQ: 10000,  // per Leadership EQ series (flat, not per selection)
  wellnessBox: 100,     // per wellness box
};

export const ROI_CALCULATOR_URL = 'https://skillfulmeans-roi-production.up.railway.app/';

// ── Campaign stages ────────────────────────────────────────────────────────
// Composition mirrors the ROI Engine's stage definitions.
export const CAMPAIGN_STAGES = [
  {
    stage: 1,
    name: 'Foundation',
    intent: 'Establish shared mental fitness language and lock initial skills into daily habit.',
    workshops: 2,
    challenges: 1,
    leadershipEQ: false,
    groupCoaching: false,
    individualCoaching: false,
    wellnessBoxes: 3,
  },
  {
    stage: 2,
    name: 'Habit',
    intent: 'Deepen practice with more workshops and challenges to build lasting habits across the team.',
    workshops: 4,
    challenges: 2,
    leadershipEQ: false,
    groupCoaching: false,
    individualCoaching: false,
    wellnessBoxes: 18,
  },
  {
    stage: 3,
    name: 'Resilience',
    intent: 'Add Leadership EQ to build team resilience and emotional intelligence.',
    workshops: 2,
    challenges: 2,
    leadershipEQ: true,
    groupCoaching: false,
    individualCoaching: false,
    wellnessBoxes: 12,
  },
  {
    stage: 4,
    name: 'Alignment',
    intent: 'Scale up workshops with Leadership EQ to align teams and culture.',
    workshops: 4,
    challenges: 2,
    leadershipEQ: true,
    groupCoaching: false,
    individualCoaching: false,
    wellnessBoxes: 18,
  },
  {
    stage: 5,
    name: 'Culture Shift',
    intent: 'Add group coaching to cascade skills across the entire organization.',
    workshops: 4,
    challenges: 2,
    leadershipEQ: true,
    groupCoaching: true,
    individualCoaching: false,
    wellnessBoxes: 18,
  },
  {
    stage: 6,
    name: 'Ecosystem',
    intent: 'Full-spectrum support with individual and group coaching for organization-wide transformation.',
    workshops: 4,
    challenges: 4,
    leadershipEQ: true,
    groupCoaching: true,
    individualCoaching: true,
    wellnessBoxes: 24,
  },
];

// ── Challenge volume tiers (by headcount) ──────────────────────────────────
// Observed from the ROI Engine: slots use a declining ratio, not a flat 30%.
// Price-per-person tiers match ChallengePricingEstimator slot bands.
const CHALLENGE_HEADCOUNT_TIERS = [
  { maxHeadcount: 200,      slots: 40,  pricePerPerson: 27 }, // ≤~150 employees → $1,080
  { maxHeadcount: 500,      slots: 60,  pricePerPerson: 24 }, // ~300 → $1,440
  { maxHeadcount: 1000,     slots: 113, pricePerPerson: 22 }, // ~750 → $2,486
  { maxHeadcount: 5000,     slots: 150, pricePerPerson: 20 }, // ~2000 (extended)
  { maxHeadcount: Infinity, slots: 200, pricePerPerson: 18 }, // 5000+ (extended)
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Resolve a company-size value (number or range string) to a representative headcount. */
export function resolveHeadcount(companySize) {
  if (!companySize) return 150;
  const str = String(companySize).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  return teamSizeToHeadcount(str);
}

/** Convert a Quick Builder team-size range string to a representative headcount. */
export function teamSizeToHeadcount(teamSize) {
  const map = {
    '1-50': 50,
    '51-200': 150,
    '201-500': 300,
    '501-1000': 750,
    '1001-5000': 2000,
    '5000+': 5000,
  };
  return map[teamSize] || 150;
}

/** Look up the challenge volume tier for a given headcount. */
export function getChallengeTier(headcount) {
  const hc = Number(headcount) || 150;
  for (const tier of CHALLENGE_HEADCOUNT_TIERS) {
    if (hc <= tier.maxHeadcount) return tier;
  }
  return CHALLENGE_HEADCOUNT_TIERS[CHALLENGE_HEADCOUNT_TIERS.length - 1];
}

/** Per-challenge price = slots × per-person rate, volume-tiered by headcount. */
export function getChallengeUnitPrice(headcount) {
  const tier = getChallengeTier(headcount);
  return tier.slots * tier.pricePerPerson;
}

/**
 * Find the closest campaign stage — the lowest stage whose composition
 * covers the given selections. If nothing covers (e.g. more workshops than
 * any stage), returns the highest stage.
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

/** Format a stage as "Stage N — Name". */
export function formatStageLabel(stage) {
  if (!stage) return '';
  return `Stage ${stage.stage} — ${stage.name}`;
}

/** Format a stage's full composition as a readable string. */
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
  return parts.join(', ');
}

/**
 * Compute the full estimate from selections.
 *
 * @param {object} opts
 * @param {number} opts.headcount        — representative employee headcount
 * @param {number} opts.workshopCount    — number of workshops selected
 * @param {number} opts.challengeCount   — number of challenges selected
 * @param {boolean} opts.hasLeadership   — any Leadership EQ selection
 * @param {boolean} opts.wantsBoxes      — wellness boxes requested
 * @returns {{ estimatedInvestment: number, matchedStage: object, stageLabel: string, breakdown: object }}
 */
export function computeEstimate({ headcount, workshopCount = 0, challengeCount = 0, hasLeadership = false, wantsBoxes = false }) {
  const matchedStage = findMatchedStage({ workshopCount, challengeCount, hasLeadership });
  const challengeUnitPrice = getChallengeUnitPrice(headcount);
  const challengeTier = getChallengeTier(headcount);

  const workshopCost = workshopCount * RATE_CARD.workshop;
  const challengeCost = challengeCount * challengeUnitPrice;
  const leadershipCost = hasLeadership ? RATE_CARD.leadershipEQ : 0;
  const boxCost = wantsBoxes ? matchedStage.wellnessBoxes * RATE_CARD.wellnessBox : 0;

  const estimatedInvestment = workshopCost + challengeCost + leadershipCost + boxCost;

  return {
    estimatedInvestment,
    matchedStage,
    stageLabel: formatStageLabel(matchedStage),
    breakdown: {
      workshopCost,
      challengeCost,
      leadershipCost,
      boxCost,
      challengeUnitPrice,
      challengeTier,
      challengeCount,
    },
  };
}