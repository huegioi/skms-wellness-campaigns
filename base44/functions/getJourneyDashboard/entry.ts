import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { loadRateCard } from '../../shared/loadRateCard.ts';

const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://app.skillfulmeans.life').replace(/\/+$/, '');

// Pricing + ROI model — the SAME file the frontend imports.
// Prices live in ../../shared/rateCard.ts. Never inline them here again.
import { STAGES, calcInvestment, runRoi } from '../../shared/journeyModel.ts';

// ── Domain opportunity (APPROVED WEIGHTS — William, 2026-07-21) ──
const DOMAIN_WEIGHTS = {
  medical:      { stress: 0.45, wellbeing: 0.45, engagement: 0,    connection: 0.10 },
  absenteeism:  { stress: 0.25, wellbeing: 0.20, engagement: 0.20, connection: 0.35 },
  presenteeism: { stress: 0.35, wellbeing: 0.25, engagement: 0.30, connection: 0.10 },
  turnover:     { stress: 0.15, wellbeing: 0.15, engagement: 0.45, connection: 0.25 },
  // workersComp removed 2026-08-08. The model no longer pays out on it -- there
  // is no defensible published coefficient -- so runRoi() returns 0 for it and
  // this row contributed nothing. Numerically a no-op; removed so nobody reads
  // the matrix and assumes we still claim it.
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

  // If only one (or zero) domain has a gap, blend in secondary matrix weights
  // so the split stays plausible instead of showing 100% in one domain.
  const domainsWithGap = domains.filter(d => raws[d] > 0);
  if (domainsWithGap.length <= 1) {
    for (const domain of domains) {
      if (raws[domain] > 0) continue;
      let secondarySum = 0;
      for (const [driver, weights] of Object.entries(DOMAIN_WEIGHTS)) {
        secondarySum += (teamDrivers[driver] || 0) * (weights[domain] || 0) * 0.15;
      }
      raws[domain] = secondarySum;
    }
  }

  const total = Object.values(raws).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return domains.map(d => ({ key: d, label: DOMAIN_LABELS[d], share: 0 }))
      .sort((a, b) => b.share - a.share);
  }

  // Raw percentages
  const shares = {};
  for (const d of domains) shares[d] = (raws[d] / total) * 100;

  // Floor domains with any gap at 10%, cap max at 60%
  for (const d of domains) {
    if (raws[d] > 0) shares[d] = Math.max(10, shares[d]);
    shares[d] = Math.min(60, shares[d]);
  }

  // Renormalize after floor/cap
  const sumAfter = domains.reduce((s, d) => s + shares[d], 0);
  for (const d of domains) shares[d] = (shares[d] / sumAfter) * 100;

  // Round to nearest 5%
  for (const d of domains) shares[d] = Math.round(shares[d] / 5) * 5;

  // Fix rounding so shares sum to exactly 100
  const roundedSum = domains.reduce((s, d) => s + shares[d], 0);
  if (roundedSum !== 100 && roundedSum > 0) {
    const largest = domains.reduce((a, b) => shares[a] >= shares[b] ? a : b);
    shares[largest] = Math.max(0, shares[largest] + (100 - roundedSum));
  }

  return domains.map(d => ({
    key: d,
    label: DOMAIN_LABELS[d],
    share: shares[d],
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
    await loadRateCard(base44);   // saved rate card overrides, before anything is priced
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

    // The "initial estimate" chart is RECOMPUTED from the stored inputs, not
    // read from the stored outputs.
    //
    // Fixed 2026-08-10. The dashboard shows two charts side by side and says
    // the difference between them is estimate vs measured. That was only true
    // while one model existed. Snapshots written before the rebuild carry the
    // OLD model's outputs -- 0.75x salary replacement cost, a workers' comp
    // driver, no reach decay -- so the left chart was running old math and the
    // right chart new math, and the gap between them was mostly the rebuild
    // rather than anything about the client's team. It made measured data look
    // far worse than the leader's guess for reasons that had nothing to do with
    // the team.
    //
    // Recomputing from the same inputs means the ONLY difference between the
    // two charts is the stress rate, which is what the comparison claims. The
    // original snapshot is still stored on the journey if we ever need to audit
    // what a client was first shown.
    const preliminaryRoi = roiInputs.employees
      ? runRoi(roiInputs)
      : (j.roi_snapshot?.outputs || null);

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
        const dashboardUrl = `${APP_BASE_URL}/FitnessRoi/dashboard?k=${j.magic_key}`;
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
      preliminary_roi: preliminaryRoi,
      /** What the client was originally shown, kept for audit only. Do not
       *  chart this -- it may have been produced by a superseded model. */
      preliminary_roi_as_first_shown: j.roi_snapshot?.outputs || null,
      team_roi: teamRoi,
      domain_opportunity: domainOpportunity,
      services: serviceList,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});