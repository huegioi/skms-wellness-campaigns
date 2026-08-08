import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { loadRateCard } from '../../shared/loadRateCard.ts';
import { getOrgDomain, deriveCompanyFromEmail } from '../../shared/emailDomain.ts';

const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') || 'https://app.skillfulmeans.life').replace(/\/+$/, '');

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

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await loadRateCard(base44);   // saved rate card overrides, before anything is priced
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

      const resolvedCompany = company_name || deriveCompanyFromEmail(normalizedEmail) || 'Unknown Company';
      const client = await base44.asServiceRole.entities.Client.create({
        name: contact_name, email: normalizedEmail,
        email_domain: getOrgDomain(normalizedEmail),
        company: resolvedCompany,
        company_size: sizeBracket, employee_count: headcountNum, industry: industry || undefined,
        is_assessment_lead: true, client_stage: 'event_follow_up',
        portal_token: crypto.randomUUID(), tags: ['MFS·ROI'],
      });
      clientId = client.id;

      const source = ref ? `Mental Fitness Journey (${ref})` : 'Mental Fitness Journey';
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
              company_name, notes: `Mental Fitness Journey · Composite: ${Math.round(quick_scores.composite)}/100`,
              referral_date: new Date().toISOString(), status: 'pending_review',
            });
            await base44.asServiceRole.entities.ReferralActivity.create({
              referral_partner_id: partner.id, referral_id: referral.id,
              message: `New Mental Fitness Journey referral: ${company_name || contact_name}`,
              activity_date: new Date().toISOString(),
            });
          }
        }
      }
    }

    // ── Emails ──
    const suppressed = await base44.asServiceRole.entities.EmailSuppression.filter({ email: normalizedEmail });
    const isSuppressed = suppressed && suppressed.length > 0;
    const teamEmails = Deno.env.get('TEAM_EMAILS');
    const now = new Date().toISOString();
    let emailSent = false;

    // a) Prospect magic-link email
    if (!isSuppressed) {
      const dashboardUrl = `${APP_BASE_URL}/FitnessRoi/dashboard?k=${magicKey}`;
      const prospectHtml = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#4a2040;">Your Mental Fitness Score + ROI projection</h2>
<p style="color:#444;font-size:14px;line-height:1.6;">Thanks for completing the quick assessment, ${escapeHtml(contact_name)}. Your private dashboard is ready — your score, your ROI projection, and the path forward.</p>
<a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:white;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;margin:16px 0;font-size:15px;">View my results</a>
<p style="color:#888;font-size:12px;margin-top:20px;">This link is private to you. Keep it safe to return any time.</p>
</body></html>`;
      try {
        emailSent = await sendSendGrid(normalizedEmail, 'Your Mental Fitness Score + ROI projection', prospectHtml);
        if (emailSent) {
          await base44.asServiceRole.entities.EmailLog.create({
            from_email: 'admin@skillfulmeans.life', to_email: normalizedEmail,
            subject: 'Your Mental Fitness Score + ROI projection',
            body_preview: `Your private dashboard link: ${dashboardUrl}`,
            date: now, direction: 'outbound', matched_client_id: clientId, matched_lead_id: leadId,
          });
        }
      } catch (e) { console.error('Prospect email failed:', e.message); }
    }

    // b) Internal team alert
    if (teamEmails) {
      const alertHtml = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2 style="color:#4a2040;">New Mental Fitness Journey</h2>
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
      let alertSent = false;
      for (const teamEmail of emailList) {
        try {
          const sent = await sendSendGrid(teamEmail, `New Mental Fitness Journey: ${company_name || contact_name}`, alertHtml);
          if (sent) alertSent = true;
        } catch (e) { console.error('Team alert email failed:', e.message); }
      }
      if (alertSent) {
        await base44.asServiceRole.entities.EmailLog.create({
          from_email: 'admin@skillfulmeans.life', to_email: teamEmails,
          subject: `New Mental Fitness Journey: ${company_name || contact_name}`,
          body_preview: `${contact_name} at ${company_name || '—'} — ${headcountNum} employees, ${industry || '—'}. Composite: ${Math.round(quick_scores.composite)}/100. Projected annual savings: $${Math.round(roiResult.annualSavings).toLocaleString()}.`,
          date: now, direction: 'outbound', matched_client_id: clientId, matched_lead_id: leadId,
        });
      }
    }

    return Response.json({ success: true, quick_scores, roi_snapshot, magic_key: magicKey, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});