import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { loadRateCard } from '../../shared/loadRateCard.ts';
import { getOrgDomain } from '../../shared/emailDomain.ts';

const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://app.skillfulmeans.life').replace(/\/+$/, '');

const DEMO_TAG = 'Demo';
const DEMO_EMAIL = 'demo-journey@skillfulmeans.life';

// Pricing + ROI model — the SAME file the frontend imports.
// Prices live in ../../shared/rateCard.ts. Never inline them here again.
import { STAGES, partForSize, calcInvestment, runRoi, quickScoreFromAnswers } from '../../shared/journeyModel.ts';

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
    await loadRateCard(base44);   // saved rate card overrides, before anything is priced
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
      name: 'Dana Reyes', email: DEMO_EMAIL, email_domain: getOrgDomain(DEMO_EMAIL), company: 'Harborview Logistics',
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