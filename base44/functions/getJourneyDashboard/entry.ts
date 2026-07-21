import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Inlined ROI model (from src/lib/roiModel.js) ──
const STAGES = [
  { num: 1, name: 'Foundation', engagement: 0.25, workshops: 2, challenges: 1, leq: false, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 1 },
  { num: 2, name: 'Habit', engagement: 0.40, workshops: 4, challenges: 2, leq: false, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 3, name: 'Resilience', engagement: 0.55, workshops: 2, challenges: 2, leq: true, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 4, name: 'Alignment', engagement: 0.65, workshops: 4, challenges: 2, leq: true, groupCoaching: false, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 5, name: 'Culture Shift', engagement: 0.80, workshops: 4, challenges: 2, leq: true, groupCoaching: true, indivCoaching: false, consultant: false, consultantFree: false, incentiveStage: 2 },
  { num: 6, name: 'Ecosystem', engagement: 1.00, workshops: 4, challenges: 4, leq: true, groupCoaching: true, indivCoaching: true, consultant: true, consultantFree: true, incentiveStage: 2 },
];
const BOX_COST = 100, WORKSHOP_WEBINAR_CAP = 150, CHALLENGE_RUN_CAP = 150, ROI_CAP_PER_DOLLAR = 8, ROI_CAP_KNEE = 5, LEQ_PER_LEADER = 250, LEQ_MIN = 10000, LEADER_FRACTION = 0.05;
const CHALLENGE_TIERS = [
  { min: 40, price: 27 }, { min: 50, price: 25 }, { min: 60, price: 24 }, { min: 100, price: 22 },
  { min: 150, price: 20 }, { min: 200, price: 18 }, { min: 250, price: 15 }, { min: 300, price: 14 },
  { min: 350, price: 13 }, { min: 400, price: 12 }, { min: 500, price: 10 }, { min: 1000, price: 9 },
];
function getChallengePrice(n) { let p = CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].price; for (const t of CHALLENGE_TIERS) if (n >= t.min) p = t.price; return p; }
function calcInvestment(stage, N, participRate) {
  const breakdown = [];
  const wsAttendees = Math.max(1, Math.round(N * participRate));
  const wsSessions = Math.ceil(wsAttendees / WORKSHOP_WEBINAR_CAP);
  const workshopCost = stage.workshops * wsSessions * 1500;
  breakdown.push({ label: 'Workshops & Webinars', cost: workshopCost });
  const participatingN = Math.max(40, Math.round(N * participRate));
  const challengeRuns = stage.challenges * Math.ceil(participatingN / CHALLENGE_RUN_CAP);
  if (stage.challenges > 0) { const price = getChallengePrice(participatingN); breakdown.push({ label: 'Challenges', cost: stage.challenges * participatingN * price }); }
  if (stage.leq) { const leaders = Math.max(1, Math.round(N * LEADER_FRACTION)); breakdown.push({ label: 'Leader EQ Training', cost: Math.max(LEQ_MIN, leaders * LEQ_PER_LEADER) }); }
  if (stage.groupCoaching) { const cohorts = Math.ceil((N * 0.16) / 12); breakdown.push({ label: 'Group Coaching', cost: cohorts * 5000 }); }
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
  const fundAbsorbedAnnual = Math.min(wellnessFund, investment);
  return { investment, investmentBreakdown: investResult.breakdown, annualSavings, netROI, paybackMonths, drivers, yearProjection: { y1, y2, y3, total3yr }, fundAbsorbedAnnual, pf, rawPerDollar, capFactor };
}

// ── Domain opportunity (APPROVED WEIGHTS — William, 2026-07-21) ──
const DOMAIN_WEIGHTS = {
  medical:      { stress: 0.45, wellbeing: 0.45, engagement: 0,    connection: 0.10 },
  absenteeism:  { stress: 0.25, wellbeing: 0.20, engagement: 0.20, connection: 0.35 },
  presenteeism: { stress: 0.35, wellbeing: 0.25, engagement: 0.30, connection: 0.10 },
  turnover:     { stress: 0.15, wellbeing: 0.15, engagement: 0.45, connection: 0.25 },
  workersComp:  { stress: 0.30, wellbeing: 0.25, engagement: 0.35, connection: 0.10 },
};
const DOMAIN_TO_INSTRUMENT = { stress: 'pss4', wellbeing: 'who5', engagement: 'uwes3', connection: 'ucla3' };
const DOMAIN_LABELS = { stress: 'Stress', wellbeing: 'Wellbeing', engagement: 'Engagement', connection: 'Connection' };

function computeDomainOpportunity(teamScores, teamDrivers) {
  const domains = ['stress', 'wellbeing', 'engagement', 'connection'];
  const raws = {};
  for (const domain of domains) {
    const inst = DOMAIN_TO_INSTRUMENT[domain];
    const teamScore = teamScores[inst] ?? 50;
    const gapFactor = Math.max(0, (50 - teamScore) / 50);
    let sum = 0;
    for (const [driver, weights] of Object.entries(DOMAIN_WEIGHTS)) {
      sum += (teamDrivers[driver] || 0) * (weights[domain] || 0);
    }
    raws[domain] = sum * gapFactor;
  }
  const total = Object.values(raws).reduce((a, b) => a + b, 0);
  return domains.map(d => ({
    key: d,
    label: DOMAIN_LABELS[d],
    share: total > 0 ? Math.round((raws[d] / total) * 20) * 5 : 0,
  })).sort((a, b) => b.share - a.share);
}

// ── Mailgun ──
async function sendSendGrid(to, subject, html) {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) { console.error('SENDGRID_API_KEY not set'); return false; }
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'admin@skillfulmeans.life', name: 'SkillfulMeans' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`SendGrid error (${response.status}): ${errorText}`);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { magic_key } = body;

    if (!magic_key) return Response.json({ error: 'missing_key' }, { status: 400 });

    const journeys = await base44.asServiceRole.entities.MfsJourney.filter({ magic_key }, undefined, 1);
    if (!journeys || journeys.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    const j = journeys[0];

    // Fetch CohortAssessment records (limit 4000 for large teams)
    const allResponses = await base44.asServiceRole.entities.CohortAssessment.filter(
      { client_id: j.client_id, survey_type: 'mfs' }, '-submitted_at', 4000
    );

    // Count distinct participants by _sid
    const respondentMap = {};
    for (const r of allResponses) {
      const sid = r.instrument_subscores?._sid;
      if (!sid) continue;
      if (!respondentMap[sid]) respondentMap[sid] = {};
      respondentMap[sid][r.instrument] = r.instrument_subscores?._normalized;
    }
    const respondentList = Object.values(respondentMap);
    const responseCount = respondentList.length;

    // Base response (pre-results — exactly what it returns today)
    const baseResponse = {
      success: true,
      company_name: j.company_name,
      contact_name: j.contact_name,
      survey_token: j.survey_token,
      status: j.status,
      quick_scores: j.quick_scores,
      roi_snapshot: j.roi_snapshot,
      response_count: responseCount,
      reminder_sent_at: j.reminder_sent_at || [],
    };

    // ── Unlocked state (5+ respondents) ──
    if (responseCount < 5) return Response.json(baseResponse);

    // Team scores: mean of stored _normalized per instrument
    const instrumentKeys = ['who5', 'pss4', 'uwes3', 'ucla3'];
    const teamScores = {};
    for (const inst of instrumentKeys) {
      const scores = respondentList.map(r => r[inst]).filter(s => s != null);
      teamScores[inst] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    }
    // Composite: mean of per-respondent composites
    const perRespondentComposites = respondentList.map(r => {
      const vals = instrumentKeys.map(k => r[k]).filter(s => s != null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }).filter(s => s != null);
    teamScores.composite = perRespondentComposites.length > 0
      ? perRespondentComposites.reduce((a, b) => a + b, 0) / perRespondentComposites.length : null;

    // Stress rate: share of respondents with pss4 < 50
    const stressCount = respondentList.filter(r => r.pss4 != null && r.pss4 < 50).length;
    const stressRateReal = responseCount > 0 ? stressCount / responseCount : 0;

    // ROI re-run with stressRate replaced by stress_rate_real
    const roiInputs = j.roi_snapshot?.inputs || {};
    const teamRoi = runRoi({ ...roiInputs, stressRate: stressRateReal });

    // Domain opportunity
    const domainOpportunity = computeDomainOpportunity(teamScores, teamRoi.drivers);

    // Fetch services for domain suggestions
    const services = await base44.asServiceRole.entities.Service.filter({ is_active: true }, 'sort_order', 200);
    const serviceList = services.map(s => ({ id: s.id, name: s.name, category: s.category }));

    // First-time alert
    if (!j.ready_alert_sent_at) {
      const teamEmails = (Deno.env.get('TEAM_EMAILS') || '').split(',').map(e => e.trim()).filter(Boolean);
      const companyName = j.company_name || 'Unknown';
      const compositeScore = teamScores.composite != null ? Math.round(teamScores.composite) : '—';
      const topDomain = domainOpportunity[0]?.label || '—';
      const annualSavings = Math.round(teamRoi.annualSavings);
      const now = new Date().toISOString();

      if (teamEmails.length > 0) {
        const subject = `${companyName} team dashboard is live — composite ${compositeScore}, top domain ${topDomain}, projected annual savings $${annualSavings.toLocaleString()}`;
        const dashboardUrl = `${new URL(req.url).origin}/FitnessRoi/dashboard?k=${j.magic_key}`;
        const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#0f766e;">${companyName} team dashboard is live</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">The team survey has reached 5+ responses and the dashboard is unlocked.</p>
<ul style="color:#444;font-size:14px;line-height:1.8;">
<li>Composite score: <strong>${compositeScore}/100</strong></li>
<li>Top opportunity domain: <strong>${topDomain}</strong></li>
<li>Projected annual savings: <strong>$${annualSavings.toLocaleString()}</strong></li>
<li>Measured stress rate: <strong>${Math.round(stressRateReal * 100)}%</strong> (leader estimated ${Math.round((roiInputs.stressRate || 0) * 100)}%)</li>
</ul>
<a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:white;padding:12px 28px;border-radius:9999px;text-decoration:none;font-weight:600;margin:12px 0;font-size:14px;">View dashboard</a>
</body></html>`;
        let alertSent = false;
        for (const email of teamEmails) {
          try {
            const sent = await sendSendGrid(email, subject, html);
            if (sent) alertSent = true;
          } catch (e) { console.error(`Alert failed for ${email}:`, e.message); }
        }
        if (alertSent) {
        await base44.asServiceRole.entities.EmailLog.create({
          from_email: 'admin@skillfulmeans.life', to_email: teamEmails.join(', '),
          subject, body_preview: `${companyName} dashboard live. Composite ${compositeScore}, top domain ${topDomain}, savings $${annualSavings}.`,
          date: now, direction: 'outbound', matched_client_id: j.client_id, matched_lead_id: j.lead_id,
        });
        }
      }
      await base44.asServiceRole.entities.MfsJourney.update(j.id, { ready_alert_sent_at: now });
    }

    return Response.json({
      ...baseResponse,
      team_scores: teamScores,
      stress_rate_real: stressRateReal,
      preliminary_roi: j.roi_snapshot?.outputs || null,
      team_roi: teamRoi,
      domain_opportunity: domainOpportunity,
      services: serviceList,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});