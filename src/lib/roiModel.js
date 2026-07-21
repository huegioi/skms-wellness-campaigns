// Mental Fitness ROI Journey — ROI Calculator model (pure functions, no DOM).
// Reuses zone definitions from the existing MFS score library.

import { SCORE_ZONES, getZone } from '@/lib/mfsScore';
export { SCORE_ZONES, getZone };

// ── Stage definitions (6) ──
export const STAGES = [
  { num: 1, name: 'Foundation',    engagement: 0.25, workshops: 2, challenges: 1, leq: false, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 1 },
  { num: 2, name: 'Habit',         engagement: 0.40, workshops: 4, challenges: 2, leq: false, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 3, name: 'Resilience',    engagement: 0.55, workshops: 2, challenges: 2, leq: true,  groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 4, name: 'Alignment',     engagement: 0.65, workshops: 4, challenges: 2, leq: true,  groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 5, name: 'Culture Shift', engagement: 0.80, workshops: 4, challenges: 2, leq: true,  groupCoaching: true,  indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 6, name: 'Ecosystem',     engagement: 1.00, workshops: 4, challenges: 4, leq: true,  groupCoaching: true,  indivCoaching: true,  consultant: true,  consultantFree: true,  incentiveStage: 2 },
];

// ── Constants ──
export const BOX_COST = 100;
export const WORKSHOP_WEBINAR_CAP = 150;
export const CHALLENGE_RUN_CAP = 150;
export const ROI_CAP_PER_DOLLAR = 8;
export const ROI_CAP_KNEE = 5;
export const LEQ_PER_LEADER = 250;
export const LEQ_MIN = 10000;
export const LEADER_FRACTION = 0.05;

export const CHALLENGE_TIERS = [
  { min: 40, price: 27 }, { min: 50, price: 25 }, { min: 60, price: 24 },
  { min: 100, price: 22 }, { min: 150, price: 20 }, { min: 200, price: 18 },
  { min: 250, price: 15 }, { min: 300, price: 14 }, { min: 350, price: 13 },
  { min: 400, price: 12 }, { min: 500, price: 10 }, { min: 1000, price: 9 },
];

export function partForSize(N) {
  if (N <= 250) return 0.25;
  if (N <= 500) return 0.20;
  if (N <= 2000) return 0.15;
  if (N <= 5000) return 0.12;
  return 0.10;
}

function getChallengePrice(n) {
  let price = CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].price;
  for (const tier of CHALLENGE_TIERS) {
    if (n >= tier.min) price = tier.price;
  }
  return price;
}

// ── Investment calculation ──
export function calcInvestment(stage, N, participRate) {
  const breakdown = [];

  // Workshops & Webinars
  const wsAttendees = Math.max(1, Math.round(N * participRate));
  const wsSessions = Math.ceil(wsAttendees / WORKSHOP_WEBINAR_CAP);
  const workshopCost = stage.workshops * wsSessions * 1500;
  breakdown.push({ label: 'Workshops & Webinars', cost: workshopCost });

  // Challenges
  const participatingN = Math.max(40, Math.round(N * participRate));
  const challengeRuns = stage.challenges * Math.ceil(participatingN / CHALLENGE_RUN_CAP);
  if (stage.challenges > 0) {
    const price = getChallengePrice(participatingN);
    breakdown.push({ label: 'Challenges', cost: stage.challenges * participatingN * price });
  }

  // Leader EQ Training
  if (stage.leq) {
    const leaders = Math.max(1, Math.round(N * LEADER_FRACTION));
    breakdown.push({ label: 'Leader EQ Training', cost: Math.max(LEQ_MIN, leaders * LEQ_PER_LEADER) });
  }

  // Group Coaching
  if (stage.groupCoaching) {
    const cohorts = Math.ceil((N * 0.16) / 12);
    breakdown.push({ label: 'Group Coaching', cost: cohorts * 5000 });
  }

  // Individual Coaching
  if (stage.indivCoaching) {
    breakdown.push({ label: 'Individual Coaching', cost: N * 0.05 * 5000 });
  }

  // Consultant (shown even when $0)
  if (stage.consultant) {
    breakdown.push({ label: 'Consultant', cost: stage.consultantFree ? 0 : 10000 });
  }

  // Wellness Boxes
  const wsBoxes = stage.workshops * wsSessions * 3;
  const chBoxes = challengeRuns * 3;
  let boxes = 0;
  if (stage.incentiveStage === 1) boxes = stage.challenges > 0 ? chBoxes : wsBoxes;
  else if (stage.incentiveStage === 2) boxes = chBoxes + wsBoxes;
  else if (stage.incentiveStage === 3) boxes = N;
  if (boxes > 0) breakdown.push({ label: 'Wellness Boxes', cost: boxes * BOX_COST });

  const total = breakdown.reduce((sum, b) => sum + b.cost, 0);
  return { total, breakdown };
}

// ── Full ROI run ──
export function runRoi({ employees, avgSalary, healthPrem, stressRate, turnoverRate, absDays, wellnessFund, participRate, stageNum }) {
  const stage = STAGES[Math.max(0, Math.min(5, (stageNum || 2) - 1))];
  const investResult = calcInvestment(stage, employees, participRate);
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
  const presenteeism = pressBase * 0.15 * 0.45 + pressBase * 0.12 * 0.30 + pressBase * 0.10 * 0.15 + pressBase * 0.12 * 0.10;

  // TURNOVER
  const turnover = employees * turnoverRate * (avgSalary * 0.75) * Math.min(0.12, pf * 0.15);

  // WORKERS COMP
  const workersComp = totalPayroll * 0.015 * 0.25 * 0.50 * Math.min(pf, 1.0);

  // SOFT CAP
  const rawAnnual = medical + absenteeism + presenteeism + turnover + workersComp;
  const rawPerDollar = rawAnnual / investment;
  let capFactor = 1.0;
  if (rawPerDollar > ROI_CAP_KNEE) {
    const eff = ROI_CAP_PER_DOLLAR - ((ROI_CAP_PER_DOLLAR - ROI_CAP_KNEE) ** 2) / ((rawPerDollar - ROI_CAP_KNEE) + (ROI_CAP_PER_DOLLAR - ROI_CAP_KNEE));
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
  const total3yr = y1 + y2 + y3;
  const paybackMonths = Math.max(1, Math.round(investment / (annualSavings / 12)));
  const fundAbsorbedAnnual = Math.min(wellnessFund, investment);

  return {
    investment,
    investmentBreakdown: investResult.breakdown,
    annualSavings,
    netROI,
    paybackMonths,
    drivers,
    yearProjection: { y1, y2, y3, total3yr },
    fundAbsorbedAnnual,
    pf,
    rawPerDollar,
    capFactor,
  };
}

// ── Quick perception scoring ──
const QUICK_MAP = [10, 25, 50, 75, 90];

export function quickScoreFromAnswers(answers) {
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