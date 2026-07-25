import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://app.skillfulmeans.life').replace(/\/+$/, '');

const DEMO_TAG = 'Demo';
const DEMO_EMAIL = 'demo-journey@skillfulmeans.life';

// ── Inlined ROI model (from createMfsJourney — backend functions can't import from src/lib) ──

const QUICK_MAP = [10, 25, 50, 75, 90];

function quickScoreFromAnswers(answers) {
  const wellbeing = QUICK_MAP[answers.wellbeing] ?? 50;
  const stressMapped = QUICK_MAP[answers.stress] ?? 50;
  const stress = 100 - stressMapped;
  const engagement = QUICK_MAP[answers.engagement] ?? 50;
  const connection = QUICK_MAP[answers.connection] ?? 50;
  const composite = (wellbeing + stress + engagement + connection) / 4;
  return { quick_scores: { who5: wellbeing, pss4: stress, uwes3: engagement, ucla3: connection, composite }, stressRateEstimate: stressMapped / 100 };
}

const STAGES = [
  { num: 1, name: 'Foundation',    engagement: 0.25, workshops: 2, challenges: 1, leq: false, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 1 },
  { num: 2, name: 'Habit',         engagement: 0.40, workshops: 4, challenges: 2, leq: false, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 3, name: 'Resilience',    engagement: 0.55, workshops: 2, challenges: 2, leq: true,  groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 4, name: 'Alignment',     engagement: 0.65, workshops: 4, challenges: 2, leq: true,  groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 5, name: 'Culture Shift', engagement: 0.80, workshops: 4, challenges: 2, leq: true,  groupCoaching: true,  indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 6, name: 'Ecosystem',     engagement: 1.00, workshops: 4, challenges: 4, leq: true,  groupCoaching: true,  indivCoaching: true,  consultant: true,  consultantFree: true,  incentiveStage: 2 },
];

const BOX_COST = 100, WORKSHOP_WEBINAR_CAP = 150, CHALLENGE_RUN_CAP = 150;
const ROI_CAP_PER_DOLLAR = 8, ROI_CAP_KNEE = 5;
const LEQ_PER_LEADER = 250, LEQ_MIN = 10000, LEADER_FRACTION = 0.05;
const CHALLENGE_TIERS = [
  { min: 40, price: 27 }, { min: 50, price: 25 }, { min: 60, price: 24 },
  { min: 100, price: 22 }, { min: 150, price: 20 }, { min: 200, price: 18 },
  { min: 250, price: 15 }, { min: 300, price: 14 }, { min: 350, price: 13 },
  { min: 400, price: 12 }, { min: 500, price: 10 }, { min: 1000, price: 9 },
];

function partForSize(N) {
  if (N <= 250) return 0.25;
  if (N <= 500) return 0.20;
  if (N <= 2000) return 0.15;
  if (N <= 5000) return 0.12;
  return 0.10;
}

function getChallengePrice(n) {
  let price = CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].price;
  for (const tier of CHALLENGE_TIERS) { if (n >= tier.min) price = tier.price; }
  return price;
}

function calcInvestment(stage, N, participRate) {
  const breakdown = [];
  const wsAttendees = Math.max(1, Math.round(N * participRate));
  const wsSessions = Math.ceil(wsAttendees / WORKSHOP_WEBINAR_CAP);
  breakdown.push({ label: 'Workshops & Webinars', cost: stage.workshops * wsSessions * 1500 });
  const participatingN = Math.max(40, Math.round(N * participRate));
  const challengeRuns = stage.challenges * Math.ceil(participatingN / CHALLENGE_RUN_CAP);
  if (stage.challenges > 0) {
    breakdown.push({ label: 'Challenges', cost: stage.challenges * participatingN * getChallengePrice(participatingN) });
  }
  if (stage.leq) {
    const leaders = Math.max(1, Math.round(N * LEADER_FRACTION));
    breakdown.push({ label: 'Leader EQ Training', cost: Math.max(LEQ_MIN, leaders * LEQ_PER_LEADER) });
  }
  if (stage.groupCoaching) { breakdown.push({ label: 'Group Coaching', cost: Math.ceil((N * 0.16) / 12) * 5000 }); }
  if (stage.indivCoaching) { breakdown.push({ label: 'Individual Coaching', cost: N * 0.05 * 5000 }); }
  if (stage.consultant) { breakdown.push({ label: 'Consultant', cost: stage.consultantFree ? 0 : 10000 }); }
  const wsBoxes = stage.workshops * wsSessions * 3;
  const chBoxes = challengeRuns * 3;
  let boxes = 0;
  if (stage.incentiveStage === 1) boxes = stage.challenges > 0 ? chBoxes : wsBoxes;
  else if (stage.incentiveStage === 2) boxes = chBoxes + wsBoxes;
  else if (stage.incentiveStage === 3) boxes = N;
  if (boxes > 0) breakdown.push({ label: 'Wellness Boxes', cost: boxes * BOX_COST });
  const total = breakdown.reduce((s, b) => s + b.cost, 0);
  return { total, breakdown };
}

function runRoi({ employees, avgSalary, healthPrem, stressRate, turnoverRate, absDays, wellnessFund, participRate, stageNum }) {
  const stage = STAGES[Math.max(0, Math.min(5, (stageNum || 2) - 1))];
  const investResult = calcInvestment(stage, employees, participRate);
  const investment = investResult.total;
  let pf = participRate * stage.engagement;
  if (stage.challenges > 0) pf *= 1.10;
  if (stage.leq && !stage.groupCoaching) pf *= 1.05;
  if (stage.groupCoaching) pf *= 1.30;
  if (stage.indivCoaching) pf *= 1.25;
  pf = Math.min(pf, 1.0);
  const stressedEmp = employees * stressRate;
  const totalPayroll = employees * avgSalary;
  const medA = stressedEmp * healthPrem * 1.40 * 0.43 * Math.min(pf * 0.5, 0.12);
  const medB = employees * pf * 358;
  const medC = stressedEmp * pf * (3363 / 4) * 0.05;
  const medical = medA * 0.50 + medB * 0.30 + medC * 0.20;
  const absA = employees * pf * absDays * (avgSalary / 250) * 0.40 * 0.28;
  const absB = employees * pf * 603 * 0.30 * 0.10;
  const absenteeism = absA * 0.60 + absB * 0.40;
  const pressBase = stressedEmp * pf * avgSalary * 0.075;
  const presenteeism = pressBase * 0.15 * 0.45 + pressBase * 0.12 * 0.30 + pressBase * 0.10 * 0.15 + pressBase * 0.12 * 0.10;
  const turnover = employees * turnoverRate * (avgSalary * 0.75) * Math.min(0.12, pf * 0.15);
  const workersComp = totalPayroll * 0.015 * 0.25 * 0.50 * Math.min(pf, 1.0);
  const rawAnnual = medical + absenteeism + presenteeism + turnover + workersComp;
  const rawPerDollar = rawAnnual / investment;
  let capFactor = 1.0;
  if (rawPerDollar > ROI_CAP_KNEE) {
    const eff = ROI_CAP_PER_DOLLAR - ((ROI_CAP_PER_DOLLAR - ROI_CAP_KNEE) ** 2) / ((rawPerDollar - ROI_CAP_KNEE) + (ROI_CAP_PER_DOLLAR - ROI_CAP_KNEE));
    capFactor = eff / rawPerDollar;
  }
  const drivers = { medical: medical * capFactor, absenteeism: absenteeism * capFactor, presenteeism: presenteeism * capFactor, turnover: turnover * capFactor, workersComp: workersComp * capFactor };
  const annualSavings = Object.values(drivers).reduce((a, b) => a + b, 0);
  const netROI = (annualSavings - investment) / investment * 100;
  const y1 = annualSavings * 0.45, y2 = annualSavings * 0.80, y3 = annualSavings * 1.00;
  const total3yr = y1 + y2 + y3;
  const paybackMonths = Math.max(1, Math.round(investment / (annualSavings / 12)));
  return { investment, investmentBreakdown: investResult.breakdown, annualSavings, netROI, paybackMonths, drivers, yearProjection: { y1, y2, y3, total3yr }, fundAbsorbedAnnual: Math.min(wellnessFund, investment), pf, rawPerDollar, capFactor };
}

function headcountToBracket(n) {
  if (n <= 50) return '1-50';
  if (n <= 200) return '51-200';
  if (n <= 500) return '201-500';
  if (n <= 1000) return '501-1000';
  if (n <= 5000) return '1001-5000';
  return '5000+';
}

// ── Instrument normalization (from submitJourneySurvey) ──
function normalizeInstrument(key, responses) {
  if (!responses) return null;
  switch (key) {
    case 'who5': {
      const raw = (responses.q1||0)+(responses.q2||0)+(responses.q3||0)+(responses.q4||0)+(responses.q5||0);
      return raw * 4;
    }
    case 'pss4': {
      const raw = (responses.q1||0)+(responses.q2||0)+(responses.q3||0)+(responses.q4||0);
      return ((16 - raw) / 16) * 100;
    }
    case 'uwes3': {
      const mean = ((responses.q1||0)+(responses.q2||0)+(responses.q3||0)) / 3;
      return (mean / 6) * 100;
    }
    case 'ucla3': {
      const raw = (responses.q1||0)+(responses.q2||0)+(responses.q3||0);
      return ((9 - raw) / 6) * 100;
    }
    default: return null;
  }
}

// ── 10 engineered respondents ──
// Team data CONTRASTS with the leader's optimistic view:
//   pss4 mean ≈ 52, 4/10 below 50 → stress_rate_real = 40% (vs leader's 25%)
//   ucla3 mean ≈ 47, 6/10 at or below 50 (connection is the hidden problem)
//   who5  mean ≈ 57 (typical, unremarkable)
//   uwes3 mean ≈ 63 (engagement is a relative strength)
const RESPONDENTS = [
  { pss4: {q1:3,q2:3,q3:2,q4:2}, ucla3: {q1:3,q2:3,q3:3}, who5: {q1:3,q2:3,q3:2,q4:3,q5:3}, uwes3: {q1:4,q2:4,q3:3} },
  { pss4: {q1:3,q2:3,q3:3,q4:1}, ucla3: {q1:3,q2:3,q3:2}, who5: {q1:3,q2:3,q3:3,q4:3,q5:3}, uwes3: {q1:4,q2:4,q3:4} },
  { pss4: {q1:2,q2:3,q3:3,q4:2}, ucla3: {q1:3,q2:2,q3:3}, who5: {q1:3,q2:2,q3:3,q4:2,q5:3}, uwes3: {q1:4,q2:3,q3:4} },
  { pss4: {q1:3,q2:2,q3:3,q4:3}, ucla3: {q1:2,q2:2,q3:2}, who5: {q1:2,q2:3,q3:3,q4:2,q5:3}, uwes3: {q1:4,q2:4,q3:3} },
  { pss4: {q1:2,q2:2,q3:2,q4:2}, ucla3: {q1:2,q2:2,q3:2}, who5: {q1:3,q2:3,q3:3,q4:3,q5:3}, uwes3: {q1:4,q2:4,q3:4} },
  { pss4: {q1:1,q2:2,q3:2,q4:1}, ucla3: {q1:2,q2:2,q3:2}, who5: {q1:3,q2:3,q3:2,q4:3,q5:3}, uwes3: {q1:4,q2:4,q3:4} },
  { pss4: {q1:2,q2:1,q3:2,q4:0}, ucla3: {q1:2,q2:1,q3:2}, who5: {q1:3,q2:3,q3:4,q4:3,q5:3}, uwes3: {q1:4,q2:4,q3:3} },
  { pss4: {q1:1,q2:2,q3:1,q4:1}, ucla3: {q1:2,q2:2,q3:1}, who5: {q1:3,q2:2,q3:3,q4:2,q5:3}, uwes3: {q1:4,q2:4,q3:4} },
  { pss4: {q1:2,q2:2,q3:1,q4:2}, ucla3: {q1:1,q2:2,q3:1}, who5: {q1:3,q2:3,q3:3,q4:3,q5:3}, uwes3: {q1:3,q2:4,q3:3} },
  { pss4: {q1:1,q2:2,q3:1,q4:1}, ucla3: {q1:2,q2:1,q3:2}, who5: {q1:3,q2:3,q3:3,q4:3,q5:2}, uwes3: {q1:4,q2:4,q3:4} },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin only' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    // ── Idempotent reset: delete existing demo journey artifacts ──
    const existingJourneys = await base44.asServiceRole.entities.MfsJourney.filter({ is_demo: true }, '-created_date', 10);
    for (const j of existingJourneys) {
      if (j.client_id) {
        const cohorts = await base44.asServiceRole.entities.CohortAssessment.filter({ client_id: j.client_id, is_demo: true }, '-created_date', 500);
        for (const c of cohorts) {
          await base44.asServiceRole.entities.CohortAssessment.delete(c.id).catch(() => {});
        }
      }
      await base44.asServiceRole.entities.MfsJourney.delete(j.id).catch(() => {});
    }
    const existingClients = await base44.asServiceRole.entities.Client.filter({ email: DEMO_EMAIL }, '-created_date', 5);
    for (const c of existingClients) {
      await base44.asServiceRole.entities.Client.delete(c.id).catch(() => {});
    }
    const existingLeads = await base44.asServiceRole.entities.Lead.filter({ email: DEMO_EMAIL }, '-created_date', 5);
    for (const l of existingLeads) {
      await base44.asServiceRole.entities.Lead.delete(l.id).catch(() => {});
    }

    // ── Ensure demo tag exists ──
    let demoTag = (await base44.asServiceRole.entities.Tag.filter({ name: DEMO_TAG }))[0];
    if (!demoTag) {
      demoTag = await base44.asServiceRole.entities.Tag.create({ name: DEMO_TAG, color: '#a855f7', description: 'Broker-demo sample data — excluded from syncs, briefings, and analytics.' });
    }

    // ── Compute leader scores + ROI (optimistic leader view) ──
    const quick_answers = { wellbeing: 3, stress: 1, engagement: 3, connection: 2 };
    const { quick_scores, stressRateEstimate } = quickScoreFromAnswers(quick_answers);
    const headcount = 250;
    const avgSalary = 65000;
    const turnoverRate = 0.18;
    const participRate = partForSize(headcount);
    const roiInputs = {
      employees: headcount, avgSalary, healthPrem: 15000,
      stressRate: stressRateEstimate, turnoverRate, absDays: 8.7,
      wellnessFund: 0, participRate, stageNum: 2,
    };
    const roiResult = runRoi(roiInputs);
    const roi_snapshot = { inputs: roiInputs, outputs: roiResult };

    // ── Create demo Client + Lead (mirroring createMfsJourney plumbing) ──
    const client = await base44.asServiceRole.entities.Client.create({
      name: 'Dana Reyes', email: DEMO_EMAIL, company: 'Harborview Logistics',
      company_size: headcountToBracket(headcount), employee_count: headcount, industry: 'Logistics',
      is_assessment_lead: true, client_stage: 'event_follow_up',
      portal_token: crypto.randomUUID(), tags: [DEMO_TAG, 'MFS·ROI'],
      is_demo: true,
    });

    const lead = await base44.asServiceRole.entities.Lead.create({
      name: 'Dana Reyes', email: DEMO_EMAIL, company: 'Harborview Logistics',
      company_size: headcountToBracket(headcount), industry: 'Logistics',
      lead_type: 'company_inquiry', status: 'cold', source: 'MFS ROI Journey (demo)',
      converted_client_id: client.id, tags: [DEMO_TAG, 'Assessment'],
      notes: `Demo journey · Composite: ${Math.round(quick_scores.composite)}/100 · Projected annual savings: $${Math.round(roiResult.annualSavings).toLocaleString()}`,
      is_demo: true,
    });

    // ── Create demo MfsJourney (status 'ready', ready_alert_sent_at set so alert never fires) ──
    const magicKey = crypto.randomUUID();
    const surveyToken = crypto.randomUUID();

    await base44.asServiceRole.entities.MfsJourney.create({
      contact_name: 'Dana Reyes', email: DEMO_EMAIL, company_name: 'Harborview Logistics',
      industry: 'Logistics', headcount, avg_salary: avgSalary, turnover_rate: turnoverRate,
      quick_answers, quick_scores, roi_snapshot, stage_selected: 2,
      survey_token: surveyToken, magic_key: magicKey,
      status: 'ready', client_id: client.id, lead_id: lead.id,
      ready_alert_sent_at: now, is_demo: true,
    });

    // ── Seed 10 anonymous employee responses (4 instruments each) ──
    const cohortRecords = [];
    for (const r of RESPONDENTS) {
      const sid = `mfj-demo-${crypto.randomUUID()}`;
      for (const [key, resp] of Object.entries(r)) {
        const raw = Object.values(resp).reduce((s, v) => s + (v || 0), 0);
        const normalized = normalizeInstrument(key, resp);
        const record = {
          client_id: client.id, survey_type: 'mfs', instrument: key,
          participant_email: '', instrument_subscores: { _sid: sid, _normalized: normalized },
          instrument_total: raw, item_responses: resp,
          cohort_year: year, submitted_at: now, is_demo: true,
        };
        if (key === 'who5') {
          record.who5_cheerful = resp.q1; record.who5_calm = resp.q2; record.who5_active = resp.q3;
          record.who5_rested = resp.q4; record.who5_interested = resp.q5; record.who5_total = raw * 4;
        }
        cohortRecords.push(record);
      }
    }
    if (cohortRecords.length) await base44.asServiceRole.entities.CohortAssessment.bulkCreate(cohortRecords);

    // ── Return three demo URLs ──
    return Response.json({
      success: true,
      dashboard_link: `${APP_BASE_URL}/FitnessRoi/dashboard?k=${magicKey}`,
      launch_link: `${APP_BASE_URL}/FitnessRoi/launch?k=${magicKey}`,
      survey_link: `${APP_BASE_URL}/MfsJourneySurvey?token=${surveyToken}`,
      magic_key: magicKey,
      survey_token: surveyToken,
      client_id: client.id,
    });
  } catch (error) {
    console.error('seedJourneyDemo error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});