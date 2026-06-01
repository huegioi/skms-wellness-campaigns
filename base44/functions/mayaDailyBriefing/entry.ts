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
  const [allLeads, allClients, allPartners, activeCampaigns] = await Promise.all([
    base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }),
    base44.asServiceRole.entities.Client.list(),
    base44.asServiceRole.entities.ReferralPartner.filter({ is_active: true }),
    base44.asServiceRole.entities.AnnualCampaign.filter({ is_active: true }),
  ]);

  // =========================================================
  // SECTION A: MASS CAMPAIGN ACTIONS
  // Check if today falls within 7 days of a campaign's trigger date
  // =========================================================
  const triggeredCampaigns = activeCampaigns.filter(campaign => {
    const monthIndex = MONTH_NAMES.indexOf(campaign.target_month);
    if (monthIndex === -1) return false;
    const prepDays = campaign.prep_trigger_days ?? 45;
    // Trigger date = 1st of target month minus prepDays, for the next upcoming occurrence
    let targetYear = now.getFullYear();
    const targetFirst = new Date(targetYear, monthIndex, 1);
    if (targetFirst < now) {
      // Already passed this year — check next year
      targetFirst.setFullYear(targetYear + 1);
    }
    const triggerDate = new Date(targetFirst);
    triggerDate.setDate(triggerDate.getDate() - prepDays);
    const daysFromTrigger = daysDiff(now, triggerDate);
    // Fire if we're within a 7-day window after the trigger date
    return daysFromTrigger >= 0 && daysFromTrigger <= 7;
  });

  const activeClientCount = allClients.filter(c => c.client_stage && c.client_stage !== 'churned').length;
  const activePartnerCount = allPartners.filter(p => p.partner_status === 'Active Partner').length;

  const campaignSummaries = triggeredCampaigns.map(campaign =>
    `📣 **${campaign.name} Prep** | Target: ${campaign.target_month} | You have **${activeClientCount} Active Clients** and **${activePartnerCount} Referral Partners** to engage. _(Queue Draft Emails)_`
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
    triggered_campaigns: triggeredCampaigns.length,
    stalled_tier1_partners: stalledPartners.length,
  };

  // =========================================================
  // Build prompt with both sections
  // =========================================================
  const prompt = `You are Maya, the Sales Director at SKMS Wellness — a mental fitness campaign company that helps organizations through workshops, 14-day challenges, leadership programs, wellness boxes, and classes. You report to William and Heather, the co-founders.

Your job is to give a concise, actionable daily briefing every morning. You are direct, warm, and strategic. You prioritize revenue-generating activities and relationship maintenance.

Today is ${todayStr}.

---

## CURRENT ACTIVE SEASONAL CAMPAIGNS — ${currentMonthName}

${themesLine}

---

## SECTION A: MASS CAMPAIGN ACTIONS

${campaignSummaries.length > 0
  ? campaignSummaries.join('\n')
  : '_No campaigns are in their prep window today._'}

---

## SECTION B: INDIVIDUAL HIGH-TOUCH ACTIONS

### Renewal Alerts (90-day window):
${renewalAlerts.length > 0 ? renewalAlerts.join('\n') : '_No clients in 90-day renewal window._'}

### Stalled Tier 1 Partners (60+ days no touchpoint):
${stalledPartnerAlerts.length > 0 ? stalledPartnerAlerts.join('\n') : '_All Tier 1 partners are up-to-date._'}

### Overdue Partner Follow-ups (from outreach pipeline) — ${overduePartners.length}:
${overduePartners.slice(0, 5).map(l => `- ${l.name} (${l.company || 'no company'}) | due: ${l.follow_up_due_date}`).join('\n') || '_None_'}

### Clients with No Contact in 60+ Days — ${silentClients.length}:
${silentClients.slice(0, 5).map(c => `- ${c.company || c.name} | last contacted: ${c.last_contacted_date || 'never'} | owner: ${c.owner || 'unassigned'}`).join('\n') || '_None_'}

---

Please write your daily briefing now. Follow these rules:
1. Open with **"Today is ${todayStr}"** so the reader knows the exact date.
2. Lead with Section A if campaigns are active, then cover Section B high-touch items.
3. **Seasonal Outreach (NEW):** Cross-reference the client and partner lists above with the Current Active Seasonal Campaigns for ${currentMonthName}. For any client or partner who is a strong fit for this month's themes (based on their industry, past programs, notes, or company profile), specifically call out a suggested outreach angle — e.g. "TechCorp has never done a men's health program — pitch a June Men's Health Month workshop." Include this as a dedicated sub-section titled "🗓️ Seasonal Outreach Opportunities."
4. Keep the full briefing under 700 words. Be specific, use real names, and end with a clear **"Top 3 Priorities for Today."**`;

  let briefing;
  try {
    briefing = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });
  } catch (err) {
    const lines = [];
    if (campaignSummaries.length) lines.push('**Section A — Campaigns:**\n' + campaignSummaries.join('\n'));
    if (renewalAlerts.length) lines.push('**Section B — Renewals:**\n' + renewalAlerts.join('\n'));
    if (stalledPartnerAlerts.length) lines.push('**Section B — Stalled Partners:**\n' + stalledPartnerAlerts.join('\n'));
    briefing = lines.join('\n\n') || `**Quick Summary:** ${stats.overdue_partners} overdue follow-ups, ${stats.silent_clients} silent clients, ${stats.stalled_tier1_partners} stalled Tier 1 partners.\n\n_Full briefing unavailable — Maya timed out. Refresh to try again._`;
  }

  return Response.json({
    briefing,
    generated_at: now.toISOString(),
    stats,
  });
});