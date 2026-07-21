import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Inlined ROI model (backend functions can't import from src/lib) ──

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

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendMailgun(apiKey, domain, to, subject, html) {
  const formData = new FormData();
  formData.append('from', `SkillfulMeans Wellness <mailgun@${domain}>`);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);
  let response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST', headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` }, body: formData
  });
  if (response.status === 401 || response.status === 404) {
    response = await fetch(`https://api.eu.mailgun.net/v3/${domain}/messages`, {
      method: 'POST', headers: { 'Authorization': `Basic ${btoa(`api:${apiKey}`)}` }, body: formData
    });
  }
  return response.ok;
}

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { contact_name, email, company_name, industry, headcount, avg_salary, turnover_rate, quick_answers, ref } = body;

    if (!contact_name || !email || !headcount) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const headcountNum = Number(headcount);
    if (!headcountNum || headcountNum < 1) {
      return Response.json({ error: 'Invalid headcount' }, { status: 400 });
    }

    const avgSalaryNum = Number(avg_salary) || 65000;
    const turnoverRateNum = Number(turnover_rate) || 0.18;
    const appUrl = new URL(req.url).origin;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // ── Rate limit + dedupe ──
    const existingJourneys = await base44.asServiceRole.entities.MfsJourney.filter(
      { email: normalizedEmail }, '-created_date', 5
    );
    if (existingJourneys.length > 0 && new Date(existingJourneys[0].created_date) > oneHourAgo) {
      return Response.json({ error: 'rate_limited', message: 'You have already submitted recently. Please try again later.' }, { status: 429 });
    }

    // ── Compute scores + ROI server-side ──
    const { quick_scores, stressRateEstimate } = quickScoreFromAnswers(quick_answers || {});
    const participRate = partForSize(headcountNum);
    const roiInputs = {
      employees: headcountNum, avgSalary: avgSalaryNum, healthPrem: 15000,
      stressRate: stressRateEstimate, turnoverRate: turnoverRateNum, absDays: 8.7,
      wellnessFund: 0, participRate, stageNum: 2,
    };
    const roiResult = runRoi(roiInputs);
    const roi_snapshot = { inputs: roiInputs, outputs: roiResult };

    // ── Dedupe by email within 30 days → update existing, reuse magic_key ──
    const existingJourney = existingJourneys.find(j => new Date(j.created_date).getTime() > thirtyDaysAgo);
    let magicKey, journeyId, clientId, leadId;

    if (existingJourney) {
      magicKey = existingJourney.magic_key;
      journeyId = existingJourney.id;
      clientId = existingJourney.client_id;
      leadId = existingJourney.lead_id;

      await base44.asServiceRole.entities.MfsJourney.update(journeyId, {
        contact_name, company_name: company_name || undefined, industry: industry || undefined,
        headcount: headcountNum, avg_salary: avgSalaryNum, turnover_rate: turnoverRateNum,
        quick_answers, quick_scores, roi_snapshot, stage_selected: 2, ref: ref || undefined,
      });

      if (clientId) {
        await base44.asServiceRole.entities.Client.update(clientId, {
          name: contact_name, company: company_name || undefined, industry: industry || undefined,
          company_size: headcountToBracket(headcountNum), employee_count: headcountNum,
        });
      }
      if (leadId) {
        await base44.asServiceRole.entities.Lead.update(leadId, {
          name: contact_name, company: company_name || undefined, industry: industry || undefined,
          company_size: headcountToBracket(headcountNum),
        });
      }
    } else {
      magicKey = crypto.randomUUID();
      const surveyToken = crypto.randomUUID();
      const sizeBracket = headcountToBracket(headcountNum);

      const client = await base44.asServiceRole.entities.Client.create({
        name: contact_name, email: normalizedEmail, company: company_name || undefined,
        company_size: sizeBracket, employee_count: headcountNum, industry: industry || undefined,
        is_assessment_lead: true, client_stage: 'event_follow_up',
        portal_token: crypto.randomUUID(), tags: ['MFS·ROI'],
      });
      clientId = client.id;

      const source = ref ? `MFS ROI Journey (${ref})` : 'MFS ROI Journey';
      const lead = await base44.asServiceRole.entities.Lead.create({
        name: contact_name, email: normalizedEmail, company: company_name || undefined,
        company_size: sizeBracket, industry: industry || undefined,
        lead_type: 'company_inquiry', status: 'cold', source,
        converted_client_id: clientId, tags: ['Assessment'],
        notes: `Composite: ${Math.round(quick_scores.composite)}/100 · Projected annual savings: $${Math.round(roiResult.annualSavings).toLocaleString()}`,
      });
      leadId = lead.id;

      await base44.asServiceRole.entities.MfsJourney.create({
        contact_name, email: normalizedEmail, company_name: company_name || undefined,
        industry: industry || undefined, headcount: headcountNum, avg_salary: avgSalaryNum,
        turnover_rate: turnoverRateNum, quick_answers, quick_scores, roi_snapshot,
        stage_selected: 2, survey_token: surveyToken, magic_key: magicKey,
        status: 'quick_done', ref: ref || undefined, client_id: clientId, lead_id: leadId,
      });

      // ── Referral plumbing ──
      if (ref) {
        const partners = await base44.asServiceRole.entities.ReferralPartner.filter({ unique_portal_id: ref });
        if (partners && partners.length > 0) {
          const partner = partners[0];
          const recentReferrals = await base44.asServiceRole.entities.Referral.filter(
            { referral_partner_id: partner.id }, '-referral_date', 50
          );
          const isDup = recentReferrals.some(r =>
            r.referral_date && (r.contact_email || '').toLowerCase().trim() === normalizedEmail &&
            new Date(r.referral_date).getTime() > thirtyDaysAgo
          );
          if (!isDup) {
            const referral = await base44.asServiceRole.entities.Referral.create({
              referral_partner_id: partner.id, referral_partner_name: partner.name,
              referred_lead_id: leadId, contact_name, contact_email: normalizedEmail,
              company_name, notes: `MFS ROI Journey · Composite: ${Math.round(quick_scores.composite)}/100`,
              referral_date: new Date().toISOString(), status: 'pending_review',
            });
            await base44.asServiceRole.entities.ReferralActivity.create({
              referral_partner_id: partner.id, referral_id: referral.id,
              message: `New MFS ROI referral: ${company_name || contact_name}`,
              activity_date: new Date().toISOString(),
            });
          }
        }
      }
    }

    // ── Emails ──
    const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email: normalizedEmail });
    const isSuppressed = suppressed && suppressed.length > 0;
    const mailgunKey = Deno.env.get('MAILGUN_API_KEY');
    const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');
    const teamEmails = Deno.env.get('TEAM_EMAILS');
    const now = new Date().toISOString();

    // a) Prospect magic-link email
    if (!isSuppressed && mailgunKey && mailgunDomain) {
      const dashboardUrl = `${appUrl}/FitnessRoi/dashboard?k=${magicKey}`;
      const prospectHtml = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#4a2040;">Your Mental Fitness Score + ROI projection</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">Thanks for completing the quick assessment, ${escapeHtml(contact_name)}. Your private dashboard is ready — your score, your ROI projection, and the path forward.</p>
<a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">View my results</a>
<p style="color:#888;font-size:12px;margin-top:20px;">This link is private to you. Keep it safe to return any time.</p>
</body></html>`;
      try {
        await sendMailgun(mailgunKey, mailgunDomain, normalizedEmail, 'Your Mental Fitness Score + ROI projection', prospectHtml);
        await base44.asServiceRole.entities.EmailLog.create({
          from_email: `mailgun@${mailgunDomain}`, to_email: normalizedEmail,
          subject: 'Your Mental Fitness Score + ROI projection',
          body_preview: `Your private dashboard link: ${dashboardUrl}`,
          date: now, direction: 'outbound', matched_client_id: clientId, matched_lead_id: leadId,
        });
      } catch (e) { console.error('Prospect email failed:', e.message); }
    }

    // b) Internal team alert
    if (teamEmails && mailgunKey && mailgunDomain) {
      const alertHtml = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#4a2040;">New MFS ROI Journey</h2>
<table style="font-size:14px;color:#444;border-collapse:collapse;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Contact:</td><td>${escapeHtml(contact_name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Company:</td><td>${escapeHtml(company_name) || '—'}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>${normalizedEmail}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Headcount:</td><td>${headcountNum}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Industry:</td><td>${escapeHtml(industry) || '—'}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Composite score:</td><td>${Math.round(quick_scores.composite)}/100</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Projected annual savings:</td><td>$${Math.round(roiResult.annualSavings).toLocaleString()}</td></tr>
</table>
</body></html>`;
      const emailList = teamEmails.split(',').map(e => e.trim()).filter(Boolean);
      for (const teamEmail of emailList) {
        try {
          await sendMailgun(mailgunKey, mailgunDomain, teamEmail, `New MFS ROI Journey: ${company_name || contact_name}`, alertHtml);
        } catch (e) { console.error('Team alert email failed:', e.message); }
      }
      await base44.asServiceRole.entities.EmailLog.create({
        from_email: `mailgun@${mailgunDomain}`, to_email: teamEmails,
        subject: `New MFS ROI Journey: ${company_name || contact_name}`,
        body_preview: `${contact_name} at ${company_name || '—'} — ${headcountNum} employees, ${industry || '—'}. Composite: ${Math.round(quick_scores.composite)}/100. Projected annual savings: $${Math.round(roiResult.annualSavings).toLocaleString()}.`,
        date: now, direction: 'outbound', matched_client_id: clientId, matched_lead_id: leadId,
      });
    }

    return Response.json({ success: true, quick_scores, roi_snapshot, magic_key: magicKey });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});