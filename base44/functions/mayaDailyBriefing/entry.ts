import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Seasonal Themes by Month ──────────────────────────────────────────────────
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

// Returns days between two dates (a - b)
function daysDiff(a, b) {
  return (a - b) / (1000 * 60 * 60 * 24);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentThemes = SEASONAL_THEMES[currentMonthName] || [];
  const themesLine = currentThemes.length > 0
    ? currentThemes.map(t => `• ${t}`).join('\n')
    : '_No specific seasonal themes for this month._';

  // --- Fetch all data in parallel ---
  const [allLeadsRaw, allClientsRaw, allPartnersRaw, activeCampaigns, qbInquiryLeadsRaw] = await Promise.all([
    base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }),
    base44.asServiceRole.entities.Client.list(),
    base44.asServiceRole.entities.ReferralPartner.filter({ is_active: true }),
    base44.asServiceRole.entities.AnnualCampaign.filter({ is_active: true }),
    base44.asServiceRole.entities.Lead.filter({ lead_type: 'company_inquiry' }),
  ]);

  // Exclude demo/broker-demo records from all briefing metrics
  const allLeads = allLeadsRaw.filter(l => !l.is_demo);
  const allClients = allClientsRaw.filter(c => !c.is_demo);
  const allPartners = allPartnersRaw.filter(p => !p.is_demo);
  const qbInquiryLeads = qbInquiryLeadsRaw.filter(l => !l.is_demo);

  // New Quick Builder inquiries: submitted via public Quick Builder, still cold, no interaction yet
  const newInquiries = qbInquiryLeads.filter(l =>
    (l.source || '').startsWith('Quick Builder') &&
    (l.status || 'cold') === 'cold' &&
    !l.last_contacted_date
  );

  // =========================================================
  // SECTION A: MASS CAMPAIGN ACTIONS
  // Active window: from (target-month-start − prep_trigger_days) through end of target month.
  // If that full window has passed this year, look ahead to next year.
  // =========================================================
  const triggeredCampaigns = activeCampaigns.map(campaign => {
    const monthIndex = MONTH_NAMES.indexOf(campaign.target_month);
    if (monthIndex === -1) return null;
    const prepDays = campaign.prep_trigger_days ?? 45;

    // Try this year first, then next year
    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
      const monthStart  = new Date(year, monthIndex, 1);
      const monthEnd    = new Date(year, monthIndex + 1, 0); // last day of target month
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

  const activeClientCount = allClients.filter(c => c.client_stage && c.client_stage !== 'churned').length;
  const activePartnerCount = allPartners.filter(p => p.partner_status === 'Active Partner').length;

  const campaignSummaries = triggeredCampaigns.map(({ campaign, label }) =>
    `📣 **${campaign.name}** (${label}) | Target: ${campaign.target_month} | You have **${activeClientCount} Active Clients** and **${activePartnerCount} Referral Partners** to engage. _(Queue Draft Emails)_`
  );

  // =========================================================
  // SECTION B: INDIVIDUAL HIGH-TOUCH ACTIONS
  // =========================================================

  // --- Renewals: 90 days before Jan 1 or July 1 ---
  // Oct 3 triggers Jan 1 cohort; Apr 3 triggers July 1 cohort
  const renewalAlerts = [];
  const jan1ThisYear = new Date(now.getFullYear(), 0, 1);
  const jan1NextYear = new Date(now.getFullYear() + 1, 0, 1);
  const jul1ThisYear = new Date(now.getFullYear(), 6, 1);
  const jul1NextYear = new Date(now.getFullYear() + 1, 6, 1);

  allClients.forEach(c => {
    if (!c.renewal_cohort) return;
    let cohortDate = null;
    if (c.renewal_cohort === 'Jan 1') {
      cohortDate = daysDiff(jan1ThisYear, now) >= -90 && daysDiff(jan1ThisYear, now) <= 0 ? jan1ThisYear : jan1NextYear;
    } else if (c.renewal_cohort === 'July 1') {
      cohortDate = daysDiff(jul1ThisYear, now) >= -90 && daysDiff(jul1ThisYear, now) <= 0 ? jul1ThisYear : jul1NextYear;
    }
    if (!cohortDate) return;
    const daysUntil = Math.round(daysDiff(cohortDate, now));
    if (daysUntil >= 0 && daysUntil <= 90) {
      renewalAlerts.push(`📅 **Upcoming Renewal:** ${c.company || c.name} is **${daysUntil} days** from their ${c.renewal_cohort} renewal. Action: Schedule Strategic Review.`);
    }
  });

  // --- Stalled Tier 1 Partners: no touchpoint in 60+ days ---
  const stalledPartners = allPartners.filter(p => {
    if (p.tier !== 'Tier 1') return false;
    const touchDate = p.last_touchpoint_date || p.last_contacted_date;
    if (!touchDate) return true; // Never contacted = stalled
    return daysDiff(now, new Date(touchDate)) > 60;
  });

  const stalledPartnerAlerts = stalledPartners.map(p => {
    const touchDate = p.last_touchpoint_date || p.last_contacted_date;
    const daysAgo = touchDate ? Math.round(daysDiff(now, new Date(touchDate))) : null;
    return `⚠️ **Stalled Partner:** No touchpoint with **${p.name}** (${p.company || 'no company'}) in ${daysAgo ? `${daysAgo} days` : 'an unknown time'}. Action: Send check-in.`;
  });

  // --- Legacy data for the existing briefing context ---
  const overduePartners = allLeads.filter(l =>
    l.follow_up_due_date && new Date(l.follow_up_due_date) < now
  );
  const activeLeadPartners = allLeads.filter(l => l.partner_status === 'active_partner');
  const silentClients = allClients.filter(c => {
    if (!c.last_contacted_date) return true;
    return daysDiff(now, new Date(c.last_contacted_date)) > 60;
  });

  const stats = {
    overdue_partners: overduePartners.length,
    silent_clients: silentClients.length,
    renewal_clients: renewalAlerts.length,
    active_partners: activeLeadPartners.length,
    triggered_campaigns: triggeredCampaigns.length, // array of {campaign, label}
    stalled_tier1_partners: stalledPartners.length,
    new_inquiries: newInquiries.length,
  };

  // =========================================================
  // Build prompt with both sections
  // =========================================================
  const prompt = `You are Maya, the operations AI at SkillfulMeans — a mental fitness company selling workshops, challenges, leadership programs, and wellness boxes. You report to William and Heather. Your voice is warm, direct, and specific.

Write today's briefing using EXACTLY this format — no extra sections, no paragraphs, no deviation:

---

[3 sentences: (1) today's date, (2) a quick read on the overall state of play using real numbers or names, (3) the single most important thing to focus on today. Be specific and human.]

**Client To-Dos**
1. [Client/company name] — [one specific next action]
2. [Client/company name] — [one specific next action]
3. [Client/company name] — [one specific next action]

**Partner To-Dos**
1. [Partner name] — [one specific next action]
2. [Partner name] — [one specific next action]
3. [Partner name] — [one specific next action]

**Campaign To-Do**
• [The single most relevant seasonal or campaign action for right now — one line]

**Other**
[1–2 sentences flagging anything else worth noting — stale data, upcoming deadline, a quick win, or new Quick Builder inquiries awaiting review.]

---

RULES:
- Each to-do is ONE line: name + action only. No sub-bullets, no explanations.
- If a section has fewer than 3 real items, write as many as the data supports — do not invent names.
- Total output should be under 200 words.

DATA (use this — do not repeat it verbatim):

Today: ${todayStr}
${currentMonthName} themes: ${currentThemes.slice(0,2).join(', ')}

Active campaigns: ${triggeredCampaigns.length > 0 ? triggeredCampaigns.map(t => `${t.campaign.name} (${t.label})`).join('; ') : 'none'}

Clients in 90-day renewal window: ${allClients.filter(c => {
  const jan1Next = new Date(now.getFullYear() + 1, 0, 1);
  const jul1This = new Date(now.getFullYear(), 6, 1);
  const jul1Next = new Date(now.getFullYear() + 1, 6, 1);
  if (c.renewal_cohort === 'Jan 1') { const d = Math.round(daysDiff(jan1Next, now)); return d >= 0 && d <= 90; }
  if (c.renewal_cohort === 'July 1') { const d = Math.round(daysDiff(jul1This < now ? jul1Next : jul1This, now)); return d >= 0 && d <= 90; }
  return false;
}).slice(0,4).map(c => `${c.company || c.name} (${c.renewal_cohort}, owner: ${c.owner || 'unassigned'})`).join(', ') || 'none'}

Clients silent 60+ days: ${silentClients.slice(0,5).map(c => `${c.company || c.name} (last contact: ${c.last_contacted_date || 'never'}, owner: ${c.owner || 'unassigned'})`).join('; ') || 'none'}

Overdue partner follow-ups: ${overduePartners.slice(0,5).map(l => `${l.name} / ${l.company || ''} (due: ${l.follow_up_due_date}, stage: ${l.follow_up_stage || l.partner_status || ''})`).join('; ') || 'none'}

Stalled Tier 1 partners (60+ days no touchpoint): ${stalledPartners.slice(0,4).map(p => `${p.name} (${p.company || ''}, last touch: ${p.last_touchpoint_date || p.last_contacted_date || 'never'})`).join(', ') || 'none'}

Active partners total: ${allPartners.filter(p => p.partner_status === 'Active Partner').length}
Active clients total: ${allClients.filter(c => c.client_stage && c.client_stage !== 'churned').length}

New Quick Builder inquiries (awaiting first contact): ${newInquiries.slice(0,5).map(l => (l.company || l.name) + ' (team: ' + (l.company_size || '?') + ', ' + (l.quickbuilder_selections?.length || 0) + ' services selected, submitted: ' + (l.created_date ? new Date(l.created_date).toLocaleDateString() : 'recently') + ')').join('; ') || 'none'}`;

  let briefing;
  try {
    briefing = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });
  } catch (err) {
    const clientItems = silentClients.slice(0,3).map((c,i) => `${i+1}. ${c.company || c.name} — Re-engage, last contact ${c.last_contacted_date || 'unknown'}`).join('\n') || '1. Review client pipeline';
    const partnerItems = overduePartners.slice(0,3).map((l,i) => `${i+1}. ${l.name} — Follow up (overdue ${l.follow_up_due_date})`).join('\n') || '1. Review partner pipeline';
    const campaignItem = triggeredCampaigns.length > 0 ? `• ${triggeredCampaigns[0].campaign.name} — ${triggeredCampaigns[0].label}` : `• Review ${currentMonthName} seasonal themes`;
    briefing = `Today is ${todayStr}. ${stats.silent_clients} clients need re-engagement and ${stats.overdue_partners} partner follow-ups are overdue. Start with your most at-risk client relationship.\n\n**Client To-Dos**\n${clientItems}\n\n**Partner To-Dos**\n${partnerItems}\n\n**Campaign To-Do**\n${campaignItem}\n\n**Other**\n${stats.renewal_clients} client(s) are in their 90-day renewal window.\n\n_Maya timed out — refresh to regenerate._`;
  }

  return Response.json({
    briefing,
    generated_at: now.toISOString(),
    stats,
  });
});