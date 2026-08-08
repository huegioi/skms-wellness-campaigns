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
  workshopTopicPrice,
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
