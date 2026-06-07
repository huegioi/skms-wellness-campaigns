import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SEASONAL_THEMES = {
  January:   ['New Year Wellness Reset', 'Dry January / Mindful Drinking', 'Goal-Setting & Habit Formation'],
  February:  ['Heart Health Month', 'Stress & Emotional Wellbeing (Valentine\'s Week)', 'Financial Wellness Month'],
  March:     ['National Nutrition Month', 'Spring Wellness Kickoff', 'Women\'s History Month — Women\'s Wellbeing'],
  April:     ['Stress Awareness Month', 'Earth Month / Nature-Based Wellness', 'Spring Mental Fitness'],
  May:       ['Mental Health Awareness Month', 'Employee Wellbeing Week', 'Physical Fitness & Sports Month'],
  June:      ['Men\'s Health Month', 'Pride Month — Inclusive Wellness', 'Summer Wellness Preview'],
  July:      ['Summer Wellness Check-In', 'UV Safety & Outdoor Health', 'Mid-Year Reset'],
  August:    ['Back-to-School Stress & Family Wellness', 'Immunization Awareness Month', 'Summer Wind-Down'],
  September: ['Suicide Prevention & Mental Health Awareness', 'Healthy Aging Month', 'Fall Wellness Kickoff'],
  October:   ['Breast Cancer Awareness Month', 'Mental Health Awareness (World Mental Health Day Oct 10)', 'Halloween & Mindful Eating'],
  November:  ['Diabetes Awareness Month', 'Gratitude & Resilience', 'Open Enrollment Season — Benefits Wellness'],
  December:  ['Holiday Stress & Burnout Prevention', 'Year-End Reflection & Goal Planning', 'Giving & Volunteer Wellness'],
};

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Convert simple markdown-ish text to HTML paragraphs/bullets
function briefingToHtml(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      if (!inList) { html += '<ul style="margin:8px 0 8px 20px;padding:0;">'; inList = true; }
      html += `<li style="margin-bottom:6px;color:#374151;">${line.slice(2)}</li>`;
    } else if (/^\*\*(.+)\*\*$/.test(line) || /^###/.test(line) || /^##/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const heading = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      html += `<h3 style="margin:20px 0 6px;font-size:15px;font-weight:700;color:#013f7c;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">${heading}</h3>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      // inline bold
      const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `<p style="margin:8px 0;color:#374151;line-height:1.6;">${formatted}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function buildEmail(briefingText, stats, dateStr) {
  const briefingHtml = briefingToHtml(briefingText);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Maya's Daily Briefing</title></head>
<body style="margin:0;padding:0;background:#f4f0e9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e9;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#013f7c;padding:28px 36px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#93c5fd;text-transform:uppercase;">SKMS Wellness</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Maya's Daily Briefing</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#bfdbfe;">${dateStr}</p>
          </td>
        </tr>

        <!-- Briefing body -->
        <tr>
          <td style="padding:32px 36px 24px;">
            ${briefingHtml}
          </td>
        </tr>

        <!-- Stats bar -->
        <tr>
          <td style="padding:0 36px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:8px;overflow:hidden;">
              <tr>
                <td align="center" style="padding:14px 8px;border-right:1px solid #d1d5db;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#013f7c;">${stats.overdue_partners}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Overdue Partners</p>
                </td>
                <td align="center" style="padding:14px 8px;border-right:1px solid #d1d5db;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#013f7c;">${stats.silent_clients}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Silent Clients</p>
                </td>
                <td align="center" style="padding:14px 8px;border-right:1px solid #d1d5db;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#013f7c;">${stats.renewal_clients}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">In Renewal Window</p>
                </td>
                <td align="center" style="padding:14px 8px;">
                  <p style="margin:0;font-size:24px;font-weight:700;color:#264d44;">${stats.active_partners}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Active Partners</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:0 36px 36px;">
            <a href="https://curriculum-designer-05b51a3b.base44.app/" style="display:inline-block;background:#013f7c;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.3px;">Open Dashboard →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Generated by Maya · SKMS Wellness · Sent daily at 7:00 AM ET</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This runs as a scheduled automation — use service role throughout
    const now = new Date();
    const currentMonthName = MONTH_NAMES[now.getMonth()];
    const dateStr = formatDate(now);

    // Run email sync first so Maya has the freshest contact data
    try {
      await base44.asServiceRole.functions.invoke('scanAdminGmailContacts', {});
      console.log('[mayaMorningBriefingEmail] Email sync completed before briefing');
    } catch (syncErr) {
      console.error('[mayaMorningBriefingEmail] Email sync failed (continuing):', syncErr.message);
    }

    // Fetch data in parallel (same logic as mayaDailyBriefing)
    const [allLeads, allClients, activeCampaigns] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.AnnualCampaign.filter({ is_active: true }),
    ]);

    const overduePartners = allLeads.filter(l =>
      l.follow_up_due_date && new Date(l.follow_up_due_date) < now
    );
    const activePartners = allLeads.filter(l => l.partner_status === 'active_partner');
    const silentClients = allClients.filter(c => {
      if (!c.last_contacted_date) return true;
      return (now - new Date(c.last_contacted_date)) > 60 * 24 * 60 * 60 * 1000;
    });
    const renewalClients = allClients.filter(c => {
      if (!c.plan_year_start) return false;
      const planDate = new Date(c.plan_year_start);
      let candidate = new Date(now.getFullYear(), planDate.getMonth(), planDate.getDate());
      if (candidate < now) candidate = new Date(now.getFullYear() + 1, planDate.getMonth(), planDate.getDate());
      const daysUntil = (candidate - now) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 90;
    });

    // ── Active campaign window: (target-month-start − prep_trigger_days) through end of target month
    const triggeredCampaigns = activeCampaigns.map(campaign => {
      const monthIndex = MONTH_NAMES.indexOf(campaign.target_month);
      if (monthIndex === -1) return null;
      const prepDays = campaign.prep_trigger_days ?? 45;
      for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
        const monthStart  = new Date(year, monthIndex, 1);
        const monthEnd    = new Date(year, monthIndex + 1, 0);
        const windowStart = new Date(monthStart);
        windowStart.setDate(windowStart.getDate() - prepDays);
        if (now >= windowStart && now <= monthEnd) {
          const inMonth = now >= monthStart;
          const daysOut = inMonth ? 0 : Math.ceil((monthStart - now) / (1000 * 60 * 60 * 24));
          const label   = inMonth
            ? `Happening now — ${campaign.target_month}`
            : `Prep — ${daysOut} day${daysOut !== 1 ? 's' : ''} out`;
          return { campaign, label };
        }
      }
      return null;
    }).filter(Boolean);

    const currentThemes = SEASONAL_THEMES[currentMonthName] || [];
    const themesLine = currentThemes.length > 0
      ? currentThemes.map(t => `• ${t}`).join('\n')
      : '_No specific seasonal themes for this month._';

    const campaignSummaries = triggeredCampaigns.map(({ campaign, label }) =>
      `📣 ${campaign.name} (${label}) | Target: ${campaign.target_month}`
    );

    const prompt = `You are Maya, the Sales Director at SKMS Wellness — a mental fitness campaign company that helps organizations through workshops, 14-day challenges, leadership programs, wellness boxes, and classes. You report to William and Heather, the co-founders.

Your job is to give a concise, actionable daily briefing every morning. You are direct, warm, and strategic. You prioritize revenue-generating activities and relationship maintenance.

SKMS sells to companies through benefits broker referral partners. The business rhythm follows the benefits calendar: plans renew in January (prep in Oct/Nov) and July (prep in April/May). May is Mental Health Month — a key marketing moment.

When giving your briefing:
- Lead with the most urgent items (overdue follow-ups, at-risk clients)
- Be specific — use names, companies, and dates
- Suggest the exact next action, not vague advice
- Flag seasonal opportunities tied to the current month
- Keep it under 600 words
- Use a friendly but professional tone
- Group items by priority: Urgent, Important, Opportunities

Here is today's data:

Today is ${now.toDateString()}.

## CURRENT SEASONAL THEMES — ${currentMonthName}
${themesLine}

## ACTIVE CAMPAIGNS
${campaignSummaries.length > 0 ? campaignSummaries.join('\n') : 'None in window today.'}

OVERDUE FOLLOW-UP PARTNERS (${overduePartners.length}):
${overduePartners.map(l => `- ${l.name} (${l.company || 'no company'}) | email: ${l.email} | stage: ${l.follow_up_stage || 'unknown'} | due: ${l.follow_up_due_date}`).join('\n') || 'None'}

ACTIVE PARTNERS (${activePartners.length}):
${activePartners.map(l => `- ${l.name} (${l.company || 'no company'}) | email: ${l.email} | referrals: ${l.referral_count || 0}`).join('\n') || 'None'}

CLIENTS NEEDING ATTENTION — no contact in 60+ days (${silentClients.length}):
${silentClients.map(c => `- ${c.company || c.name} | contact: ${c.name} | last contacted: ${c.last_contacted_date || 'never'} | owner: ${c.owner || 'unassigned'}`).join('\n') || 'None'}

CLIENTS IN RENEWAL WINDOW — plan year starts within 90 days (${renewalClients.length}):
${renewalClients.map(c => `- ${c.company || c.name} | plan year start: ${c.plan_year_start} | owner: ${c.owner || 'unassigned'}`).join('\n') || 'None'}

Cross-reference the seasonal themes and active campaigns above with clients/partners. Suggest specific outreach angles in a dedicated "🗓️ Seasonal Outreach Opportunities" section.

Please give your daily briefing now.`;

    const briefing = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    const stats = {
      overdue_partners: overduePartners.length,
      silent_clients: silentClients.length,
      renewal_clients: renewalClients.length,
      active_partners: activePartners.length,
    };

    const subject = `Maya's Daily Briefing — ${dateStr}`;
    const htmlBody = buildEmail(briefing, stats, dateStr);

    const recipients = ['william@skillfulmeans.life', 'heather@skillfulmeans.life'];

    await Promise.all(recipients.map(to =>
      base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: htmlBody,
        from_name: 'Maya · SKMS Wellness',
      })
    ));

    console.log(`Maya briefing email sent to ${recipients.join(', ')} on ${dateStr}`);
    return Response.json({ success: true, sent_to: recipients, date: dateStr, stats });
  } catch (error) {
    console.error('Maya briefing email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});