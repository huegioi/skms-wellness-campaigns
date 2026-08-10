/**
 * Mental Fitness Journey — investment + ROI model.
 *
 * Imported by BOTH runtimes, exactly like the rate card:
 *   · Deno    — import { runRoi } from '../../shared/journeyModel.ts'
 *   · Frontend— import { runRoi } from '@/lib/roiModel'  (which re-exports this)
 *
 * This model owns the SAVINGS math only. Every price comes from rateCard.ts,
 * so the public Journey and the Quick Builder always quote the same number for
 * the same company. Before this file existed the same model was inlined into
 * three Deno functions and src/lib/roiModel.js, and they had drifted: the
 * Journey used 5% of headcount as leaders at $250 each against the rate card's
 * 0.5% at $1,250, understating a 500-person Stage 3 by $7,350.
 */
import {
  RATE_CARD,
  CAMPAIGN_STAGES,
  CHALLENGE_TIERS,
  workshopTopicPrice,
  sessionsPerWorkshop,
  challengeSlots,
  challengeRatePerPerson,
  boxCountFor,
  challengePrice,
  leadershipEqPrice,
} from './rateCard.ts';

// ── ROI presentation caps (not prices) ────────────────────────────────────
export const ROI_CAP_PER_DOLLAR = 8;
export const ROI_CAP_KNEE = 5;

/** Engagement factor per stage, used by the savings model. */
const ENGAGEMENT = [0.25, 0.40, 0.55, 0.65, 0.80, 1.00];

export interface JourneyStage {
  num: number; name: string; engagement: number;
  workshops: number; challenges: number;
  leq: boolean; groupCoaching: boolean; indivCoaching: boolean;
  consultant: boolean; consultantFree: boolean;
}

export const STAGES: JourneyStage[] = CAMPAIGN_STAGES.map((s, i) => ({
  num: s.stage,
  name: s.name,
  engagement: ENGAGEMENT[i],
  workshops: s.workshops,
  challenges: s.challenges,
  leq: s.leadershipEQ,
  groupCoaching: s.groupCoaching,
  indivCoaching: s.individualCoaching,
  consultant: s.stage === 6,
  consultantFree: s.stage === 6,
}));

/** Expected participation by company size — savings model only, not pricing. */
export function partForSize(N: number): number {
  if (N <= 250) return 0.25;
  if (N <= 500) return 0.20;
  if (N <= 2000) return 0.15;
  if (N <= 5000) return 0.12;
  return 0.10;
}

export interface InvestmentLine { label: string; cost: number }

/**
 * Investment for a stage at a headcount, priced entirely from the rate card.
 * Matches computeQuote() for the same stage and headcount, by construction.
 */
export function calcInvestment(
  stage: JourneyStage,
  N: number,
): { total: number; breakdown: InvestmentLine[] } {
  const tier = CAMPAIGN_STAGES.find(s => s.stage === stage.num) || CAMPAIGN_STAGES[0];
  const breakdown: InvestmentLine[] = [];

  breakdown.push({
    label: 'Workshops & Webinars',
    cost: tier.workshops * workshopTopicPrice(N),
  });

  if (tier.challenges > 0) {
    breakdown.push({ label: 'Challenges', cost: tier.challenges * challengePrice(N) });
  }

  if (tier.leadershipEQ) {
    const leq = leadershipEqPrice(N, {
      coachingBlocks: tier.coachingBlocks,
      lcpRounds: tier.lcpRounds,
    });
    breakdown.push({ label: 'Leader EQ Training', cost: leq.total });
  }

  // Stage 6 includes a consultant at no charge — shown so the value is visible.
  if (stage.consultant) breakdown.push({ label: 'Consultant', cost: 0 });

  // 3 per workshop section + 3 per challenge — same rule as computeQuote.
  breakdown.push({
    label: 'Wellness Boxes',
    cost: boxCountFor(tier, N) * RATE_CARD.wellnessBox,
  });

  const total = breakdown.reduce((sum, b) => sum + b.cost, 0);
  return { total, breakdown };
}

// ── Full ROI run ──────────────────────────────────────────────────────────
export function runRoi({
  employees, avgSalary, healthPrem, stressRate, turnoverRate,
  absDays, wellnessFund, participRate, stageNum,
}: {
  employees: number; avgSalary: number; healthPrem: number; stressRate: number;
  turnoverRate: number; absDays: number; wellnessFund: number;
  participRate: number; stageNum: number;
}) {
  const stage = STAGES[Math.max(0, Math.min(5, (stageNum || 2) - 1))];
  const investResult = calcInvestment(stage, employees);
  const investment = investResult.total;

  // Participation factor
  let pf = participRate * stage.engagement;
  if (stage.challenges > 0) pf *= 1.10;
  if (stage.leq && !stage.groupCoaching) pf *= 1.05;
  if (stage.groupCoaching) pf *= 1.30;
  if (stage.indivCoaching) pf *= 1.25;
  pf = Math.min(pf, 1.0);

  const stressedEmp = employees * stressRate;
  const totalPayroll = employees * avgSalary;

  // MEDICAL
  const medA = stressedEmp * healthPrem * 1.40 * 0.43 * Math.min(pf * 0.5, 0.12);
  const medB = employees * pf * 358;
  const medC = stressedEmp * pf * (3363 / 4) * 0.05;
  const medical = medA * 0.50 + medB * 0.30 + medC * 0.20;

  // ABSENTEEISM
  const absA = employees * pf * absDays * (avgSalary / 250) * 0.40 * 0.28;
  const absB = employees * pf * 603 * 0.30 * 0.10;
  const absenteeism = absA * 0.60 + absB * 0.40;

  // PRESENTEEISM
  const pressBase = stressedEmp * pf * avgSalary * 0.075;
  const presenteeism =
    pressBase * 0.15 * 0.45 + pressBase * 0.12 * 0.30 +
    pressBase * 0.10 * 0.15 + pressBase * 0.12 * 0.10;

  // TURNOVER
  const turnover = employees * turnoverRate * (avgSalary * 0.75) * Math.min(0.12, pf * 0.15);

  // WORKERS COMP
  const workersComp = totalPayroll * 0.015 * 0.25 * 0.50 * Math.min(pf, 1.0);

  // SOFT CAP
  const rawAnnual = medical + absenteeism + presenteeism + turnover + workersComp;
  const rawPerDollar = rawAnnual / investment;
  let capFactor = 1.0;
  if (rawPerDollar > ROI_CAP_KNEE) {
    const eff = ROI_CAP_PER_DOLLAR -
      ((ROI_CAP_PER_DOLLAR - ROI_CAP_KNEE) ** 2) /
      ((rawPerDollar - ROI_CAP_KNEE) + (ROI_CAP_PER_DOLLAR - ROI_CAP_KNEE));
    capFactor = eff / rawPerDollar;
  }

  const drivers = {
    medical: medical * capFactor,
    absenteeism: absenteeism * capFactor,
    presenteeism: presenteeism * capFactor,
    turnover: turnover * capFactor,
    workersComp: workersComp * capFactor,
  };

  const annualSavings = Object.values(drivers).reduce((a, b) => a + b, 0);
  const netROI = (annualSavings - investment) / investment * 100;
  const y1 = annualSavings * 0.45;
  const y2 = annualSavings * 0.80;
  const y3 = annualSavings * 1.00;

  return {
    investment,
    investmentBreakdown: investResult.breakdown,
    annualSavings,
    netROI,
    paybackMonths: Math.max(1, Math.round(investment / (annualSavings / 12))),
    drivers,
    yearProjection: { y1, y2, y3, total3yr: y1 + y2 + y3 },
    fundAbsorbedAnnual: Math.min(wellnessFund, investment),
    pf,
    rawPerDollar,
    capFactor,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 *  RESEARCH_MODEL — every coefficient in the savings model, with its source.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Added 2026-08-08 ALONGSIDE runRoi(), which is unchanged and still live.
 * Nothing reads this block yet; surfaces migrate one at a time so a bad
 * coefficient cannot take down the Journey, the dashboard and the outreach
 * drafter in one go.
 *
 * The rule: a number lives here or it does not exist. If you find a
 * coefficient inline in a component, that is a bug — route it through here.
 * Every entry carries the study it came from, because the finding that
 * prompted this rebuild was that the old model's two largest inputs had no
 * traceable source at all.
 */
export const RESEARCH_MODEL = {
  /** Participation odds ratios. Odds compound; percentages do not. */
  participation: {
    /** Observed floor with no design conditions. Illinois: 10.6% of all invited. */
    base: 0.10,
    or: {
      /** Madrian & Shea 2001 (QJE): 37% -> 86% on the default alone, implied
       *  OR around 10. Richter 2023 (JAMA Intern Med): 60% vs 34%, OR ~2.9.
       *  Discounted hard because no trial has tested opt-out in workplace
       *  wellness specifically. */
      optOut: 1.90,
      /** Jorgensen 2016 (BMJ Open, n=10,605): leisure-only availability carried
       *  OR 0.70 for contact with a health professional. This is 1/0.70 — the
       *  only coefficient here taken from its source without discounting. */
      workday: 1.43,
      /** Halpern 2015 (NEJM, n=2,538): 90.0% vs 13.7% acceptance for reward vs
       *  deposit framing at equal expected value. Discounted almost to nothing
       *  because SkillfulMeans campaigns are employer-paid by default. */
      noCost: 1.35,
      /** Kullgren 2013 (Annals) and Patel 2016 (JGIM). Patel found PURE team
       *  goals performed no better than control — the effect belongs to hybrid
       *  individual+team designs. Leader sponsorship has no pooled effect size
       *  anywhere (CDC/NIOSH review of 21 studies), so this is the least
       *  defensible OR here and is set lowest for that reason. */
      teamLeader: 1.25,
      /** Haisley, Volpp, Pellathy & Loewenstein 2012 (RCT): HRA completion 64%
       *  under a lottery vs 44% for an equal-value grocery certificate and 40%
       *  for cash — implied OR ~2.67. Discounted to 1.20 because their draw ran
       *  WEEKLY in teams of 4-8, so the chance of winning was high and
       *  recurring; a campaign raffles boxCountFor() boxes once. Standard
       *  SkillfulMeans delivery, so it is always on. */
      raffle: 1.20,
    },
    /** Always applied — the raffle is delivery, not a client option. */
    alwaysOn: ['raffle'],
  },

  /** Reach decays without re-prompting. Two forces run in opposite directions:
   *  effects ramp UP as the programme matures, reach falls DOWN. Both belong. */
  reachRetention: {
    /** Illinois measured the same cohort twice: the fall wellness activity went
     *  27.4% -> 13.3% (-51%) and spring 22.4% -> 10.4% (-54%), while
     *  incentivised screening decayed only -24%. Behavioural activities decay
     *  about twice as fast as one-touch events. Gentler than Illinois here
     *  because that programme had no re-engagement mechanism. */
    y2: 0.75,
    /** Extrapolated. Robroek 2012 (JMIR) shows why this is a design choice and
     *  not a constant: in a period with no questionnaire prompt, 6% of the
     *  un-prompted group visited the site versus 27% of those receiving monthly
     *  emails (OR 5.88). Engagement tracks prompting, not programme quality. */
    y3: 0.60,
  },

  /** Effect sizes by scenario. Conservative is INTERNAL ONLY — the floor we
   *  hold ourselves to, never shown to a client. */
  effects: {
    presenteeism: { conservative: 0.05, base: 0.20, optimistic: 0.30 },
    absenteeism:  { conservative: 0.00, base: 0.10, optimistic: 0.15 },
    turnover:     { conservative: 0.00, base: 0.05, optimistic: 0.10 },
    medical:      { conservative: 0.00, base: 1.00, optimistic: 1.60 },
  },

  costBases: {
    /** Share of salary lost to impaired performance in a distressed employee.
     *  Literature puts distress-related productivity loss at 5-10%. */
    presenteeismLossFraction: 0.075,
    /** Multiple of salary to replace a leaver. WAS 0.75, which traced to a
     *  single UNCITED sentence in a 2019 Gallup article — no study behind it.
     *  Boushey & Glynn (CAP, ~30 case studies across 11 papers) put the median
     *  near 20% of salary; Dube, Freeman & Reich measured 9% of annual wage
     *  directly across 1,080 establishments. Retention mechanism per Moen 2017
     *  (STAR): work redesign reduced voluntary exits where wellness benefits
     *  did not — three RCTs covering ~86,000 employees found no effect on
     *  tenure or job separation. */
    replacementCostMultiple: 0.20,
    /** Wang 2007 (JAMA, n=604): targeted depression care produced roughly
     *  $1,800 per employee per year net benefit. Applies ONLY to those actually
     *  routed into treatment, not to everyone reached. */
    benefitPerRoutedPerson: 1800,
    /** Share of distressed participants who actually engage treatment.
     *  Deliberately low — most programmes never measure this. */
    routeRate: 0.12,
    workDaysPerYear: 250,
  },

  /** Effects arrive gradually. Consistent with Deloitte Canada's 1.62 -> 2.18
   *  maturation over three years. */
  ramp: { y1: 0.45, y2: 0.80, y3: 1.00 },

  /** Dose and depth. Bigger programmes should show diminishing rather than
   *  linear returns; saturation is the shape parameter, not a finding. */
  dose: {
    workshop: 1, challenge: 3, leadershipEq: 6,
    groupCoaching: 5, individualCoaching: 4, saturation: 18,
    /** JD-R (Bakker & Demerouti): job resources rise for everyone a trained
     *  leader manages, not only for the leader. */
    wcLeadershipEq: 0.20,
    wcGroupCoaching: 0.10,
  },

  /** Published ROI benchmarks. Ratios are DIMENSIONLESS — never currency-convert
   *  one. GBP 6.30 per GBP 1 is $6.30 per $1, not $8.00. */
  benchmarks: [
    { v: 0.00, label: 'Illinois / Song & Baicker / Fleming', note: 'Three RCTs, ~86,000 employees, up to three years. No significant effect on employment outcomes.' },
    { v: 1.62, label: 'Deloitte Canada, year 1', note: 'CA$1.62 per $1.' },
    { v: 2.18, label: 'Deloitte Canada, 3 years', note: 'Rises as programmes mature.' },
    { v: 2.65, label: 'Chisholm 2016, employer share', note: 'Productivity returns only, 2.3-3.0:1. The familiar 4:1 counts monetised health gains the employer never captures.' },
    { v: 4.10, label: 'Deloitte UK, reactive', note: 'Support after someone is already struggling.' },
    { v: 4.20, label: 'Deloitte UK, proactive', note: 'Targeted at identified at-risk groups.' },
    { v: 4.70, label: 'Deloitte UK, average', note: '36 ROIs pooled from 26 studies. The 2022 edition headline was 5:1; this is the 2024 figure.' },
    { v: 6.30, label: 'Deloitte UK, universal', note: 'Whole-population interventions, by stage of intervention. Deloitte reports 5.2:1 for the same category in a second table, by recipient group size, and pooled only ROIs reported as statistically significant.' },
  ],

  /** Anything above this has no published support for a whole-population
   *  workplace programme. A bound, not a target. If the model exceeds it, the
   *  effect sizes are too generous or participation is one the rate card
   *  cannot serve. The model live before this rebuild sat at 6.14:1. */
  ceiling: 6.30,
};

export type ParticipationCondition =
  'optOut' | 'workday' | 'noCost' | 'teamLeader' | 'raffle';

/**
 * Participation from a set of design conditions, applied as odds ratios to a
 * base rate. The raffle is standard delivery and is always included.
 */
export function participationFrom(
  conditions: Partial<Record<ParticipationCondition, boolean>> = {},
  base: number = RESEARCH_MODEL.participation.base,
): number {
  const b = Math.min(0.9, Math.max(0.001, base));
  let odds = b / (1 - b);
  for (const [key, or] of Object.entries(RESEARCH_MODEL.participation.or)) {
    const always = RESEARCH_MODEL.participation.alwaysOn.includes(key);
    if (always || conditions[key as ParticipationCondition]) odds *= or;
  }
  return Math.min(0.95, odds / (1 + odds));
}

/** Participation when every design condition is met. */
export function participationAtFullDelivery(base?: number): number {
  return participationFrom(
    { optOut: true, workday: true, noCost: true, teamLeader: true, raffle: true },
    base,
  );
}

/* ── Capacity ──────────────────────────────────────────────────────────────
 * The rate card is NOT participation-neutral. Workshops are priced at
 * attendanceRate, seated maxAttendeesPerSession to a session; challenges are
 * sold as challengeEngagementRate of headcount in slots bought outright. A
 * campaign therefore pays to serve a specific number of people, and modelling
 * participation above that credits savings for people nobody bought capacity
 * for.
 *
 * Take the LARGER modality rather than the sum — the same person attends both
 * a workshop and a challenge, so summing would double-count reach.
 */
export function pricedCapacity(stage: JourneyStage, N: number): number {
  if (!(N > 0)) return 0;
  const tier = CAMPAIGN_STAGES.find(s => s.stage === stage.num) || CAMPAIGN_STAGES[0];
  const seats = tier.workshops > 0
    ? sessionsPerWorkshop(N) * RATE_CARD.maxAttendeesPerSession
    : 0;
  const slots = tier.challenges > 0 ? challengeSlots(N) : 0;
  return Math.min(1, Math.max(seats, slots) / N);
}

/**
 * What the campaign costs once capacity is bought to match real participation.
 * Uses the same band and smoothing rules as challengePrice(), so a campaign
 * sized this way is still priced off the rate card rather than beside it.
 */
export function investmentAt(stage: JourneyStage, N: number, participation: number): number {
  const tier = CAMPAIGN_STAGES.find(s => s.stage === stage.num) || CAMPAIGN_STAGES[0];
  const reached = Math.max(0, N * participation);

  const sessions = tier.workshops > 0
    ? Math.max(1, Math.ceil(reached / RATE_CARD.maxAttendeesPerSession))
    : 0;
  const topicPrice = RATE_CARD.workshopFirstSession
    + Math.max(0, sessions - 1) * RATE_CARD.workshopExtraSession;

  const slots = tier.challenges > 0
    ? Math.max(RATE_CARD.challengeMinSlots, Math.round(reached))
    : 0;
  const raw = slots * challengeRatePerPerson(slots);
  const cheaperUpBand = CHALLENGE_TIERS.filter(t => t.min > slots).map(t => t.min * t.price);
  const perChallenge = cheaperUpBand.length ? Math.min(raw, ...cheaperUpBand) : raw;

  const leq = tier.leadershipEQ
    ? leadershipEqPrice(N, { coachingBlocks: tier.coachingBlocks, lcpRounds: tier.lcpRounds }).total
    : 0;

  const boxes = RATE_CARD.boxesPerWorkshopSection * tier.workshops * Math.max(1, sessions)
              + RATE_CARD.boxesPerChallenge * tier.challenges;

  return (tier.workshops * topicPrice)
       + (tier.challenges * perChallenge)
       + leq
       + (boxes * RATE_CARD.wellnessBox);
}

// ── Quick perception scoring ──────────────────────────────────────────────
const QUICK_MAP = [10, 25, 50, 75, 90];

export function quickScoreFromAnswers(answers: Record<string, number>) {
  const wellbeing = QUICK_MAP[answers.wellbeing] ?? 50;
  const stressMapped = QUICK_MAP[answers.stress] ?? 50;
  const stress = 100 - stressMapped;
  const engagement = QUICK_MAP[answers.engagement] ?? 50;
  const connection = QUICK_MAP[answers.connection] ?? 50;
  const composite = (wellbeing + stress + engagement + connection) / 4;
  return {
    quick_scores: { who5: wellbeing, pss4: stress, uwes3: engagement, ucla3: connection, composite },
    stressRateEstimate: stressMapped / 100,
  };
}
