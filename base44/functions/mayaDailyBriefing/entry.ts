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

function daysDiff(a, b) {
  return (a - b) / (1000 * 60 * 60 * 24);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user;
  try {
    user = await base44.auth.me();
  } catch (e) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentThemes = SEASONAL_THEMES[currentMonthName] || [];

  // ── Single bundle call (global + knowledge + persona) + delivery in parallel ──
  const _ik = Deno.env.get('MAYA_INTERNAL_KEY');
  const [bundleRes, deliveryResponse, salesResponse] = await Promise.all([
    base44.functions.invoke('mayaContext', {
      action: 'bundle',
      include_global: true,
      categories: ['sales_process', 'delivery'],
      internal_key: _ik,
    }),
    // Delivery context is non-fatal: a failure here should degrade the briefing, not kill it.
    base44.functions.invoke('mayaContext', { action: 'delivery', internal_key: _ik }).catch((e) => {
      console.log('[mayaDailyBriefing] delivery context failed:', e?.message || e);
      return { data: {} };
    }),
    // Sales context — same non-fatal treatment.
    base44.functions.invoke('mayaContext', { action: 'sales', internal_key: _ik }).catch((e) => {
      console.log('[mayaDailyBriefing] sales context failed:', e?.message || e);
      return { data: {} };
    }),
  ]);
  const bd = bundleRes.data || {};
  const globalContext = bd.globalText || '';
  const data = bd.globalData || {};
  const clients = data.clients || [];
  const leads = data.leads || [];
  const partners = data.partners || [];
  const newInquiries = data.newInquiries || [];
  const knowledgeText = bd.knowledgeText || '';
  const MAYA_PERSONA = bd.persona || '';
  const delivery = deliveryResponse.data || {};
  const sales = salesResponse.data || {};

  // ── Sync reminder candidates to persistent MayaReminder records ──
  let openReminders = [];
  let overdueReminders = 0;
  try {
    const allReminders = await base44.asServiceRole.entities.MayaReminder.list('trigger_date', 500);
    const existingKeys = new Set(allReminders.map(r => r.dedupe_key));
    // Delivery and sales candidates share one queue; `category` is what splits them into
    // the two sections of the brief.
    const candidates = [
      ...(delivery.reminderCandidates || []).map(c => ({ ...c, category: c.category || 'delivery' })),
      ...(sales.reminderCandidates || []).map(c => ({ ...c, category: c.category || 'sales' })),
    ];
    for (const c of candidates) {
      if (existingKeys.has(c.key)) continue;
      try {
        await base44.asServiceRole.entities.MayaReminder.create({
          reminder_type: c.type,
          category: c.category,
          dedupe_key: c.key,
          text: c.text,
          client_id: c.clientId || '',
          client_name: c.client || '',
          lead_id: c.leadId || '',
          referral_partner_id: c.referralPartnerId || '',
          amount: c.amount != null ? c.amount : undefined,
          source_event_id: c.eventId || '',
          source_proposal_id: c.proposalId || '',
          trigger_date: c.triggerDate,
          status: 'open',
        });
      } catch (e) {
        console.log('[mayaDailyBriefing] Failed to create reminder:', c.key, e.message);
      }
    }
    // Fetch all open reminders sorted by trigger_date ascending
    const rawOpen = await base44.asServiceRole.entities.MayaReminder.filter({ status: 'open' }, 'trigger_date', 500);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    // Drop challenge-report follow-ups whose challenge ended more than 14 days ago.
    // trigger_date = challenge_end + 1, so ageDays > 14 means the challenge is stale.
    const freshOpen = rawOpen.filter(r => {
      if (r.reminder_type !== 'challenge_report') return true;
      const triggerStart = new Date(r.trigger_date);
      if (isNaN(triggerStart.getTime())) return true;
      triggerStart.setHours(0, 0, 0, 0);
      const ageDays = Math.round((todayStart - triggerStart) / 86400000);
      return ageDays <= 14;
    });
    openReminders = freshOpen.map(r => {
      const triggerStart = new Date(r.trigger_date);
      triggerStart.setHours(0, 0, 0, 0);
      const overdueDays = Math.round((todayStart - triggerStart) / 86400000);
      return {
        id: r.id,
        text: r.text,
        reminder_type: r.reminder_type,
        // Older records predate the field; they were all delivery-side.
        category: r.category || 'delivery',
        client_name: r.client_name || '',
        amount: r.amount ?? null,
        trigger_date: r.trigger_date,
        overdue: overdueDays >= 3,
        overdueDays,
      };
    }).sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return new Date(a.trigger_date) - new Date(b.trigger_date);
    });
    overdueReminders = openReminders.filter(r => r.overdue).length;
  } catch (e) {
    console.log('[mayaDailyBriefing] Reminder sync failed:', e.message);
  }

  const contextWarnings = [];
  if (!globalContext || bundleRes.status !== 200) {
    contextWarnings.push(`⚠ I couldn't load the global context (context service returned ${bundleRes.status})`);
  }
  if (!knowledgeText) {
    contextWarnings.push(`⚠ I couldn't load the knowledge base`);
  }
  if (!MAYA_PERSONA) {
    contextWarnings.push(`⚠ I couldn't load the persona`);
  }
  if (!delivery || deliveryResponse.data?.error) {
    contextWarnings.push(`⚠ I couldn't load the delivery context (context service returned ${deliveryResponse.status})`);
  }

  // ── Fetch active campaigns separately (specific to daily briefing) ──
  let activeCampaigns = [];
  try {
    activeCampaigns = await base44.asServiceRole.entities.AnnualCampaign.filter({ is_active: true });
  } catch (e) {
    console.log('[mayaDailyBriefing] Failed to fetch campaigns:', e.message);
  }

  // =========================================================
  // SECTION A: MASS CAMPAIGN ACTIONS
  // =========================================================
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

  const activeClientCount = clients.filter(c => c.client_stage && c.client_stage !== 'churned').length;
  const activePartnerCount = partners.filter(p => p.partner_status === 'Active Partner').length;

  // =========================================================
  // SECTION B: INDIVIDUAL HIGH-TOUCH ACTIONS
  // =========================================================

  // Renewals: 90 days before Jan 1 or July 1
  const renewalAlerts = [];
  const jan1ThisYear = new Date(now.getFullYear(), 0, 1);
  const jan1NextYear = new Date(now.getFullYear() + 1, 0, 1);
  const jul1ThisYear = new Date(now.getFullYear(), 6, 1);
  const jul1NextYear = new Date(now.getFullYear() + 1, 6, 1);

  clients.forEach(c => {
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

  // Stalled Tier 1 Partners: no touchpoint in 60+ days
  const stalledPartners = partners.filter(p => {
    if (p.tier !== 'Tier 1') return false;
    const touchDate = p.last_touchpoint_date || p.last_contacted_date;
    if (!touchDate) return true;
    return daysDiff(now, new Date(touchDate)) > 60;
  });

  // Legacy data for briefing context
  const overduePartners = leads.filter(l =>
    l.follow_up_due_date && new Date(l.follow_up_due_date) < now
  );
  const activeLeadPartners = leads.filter(l => l.partner_status === 'active_partner');
  const silentClients = clients.filter(c => {
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
    new_inquiries: newInquiries.length,
    delivery_sessions_today_tomorrow: delivery.todayTomorrowCount || 0,
    delivery_presenter_gaps: delivery.presenterGapCount || 0,
    delivery_challenge_gaps: (delivery.challengeAssessmentGaps || []).length,
    delivery_unscheduled_services: delivery.unscheduledServicesTotal || 0,
    renewal_review_gaps: (delivery.renewalReviewGaps || []).length,
    open_follow_ups: openReminders.length,
    overdue_follow_ups: overdueReminders,
  };

  // =========================================================
  // Build prompt using shared global context + computed action items
  // =========================================================
  const prompt = `${MAYA_PERSONA}

Write today's briefing using EXACTLY this format — no extra sections, no paragraphs, no deviation:

---

[3 sentences: (1) today's date, (2) a quick read on the overall state of play using real numbers or names, (3) the single most important thing to focus on today. Be specific and human.]

**Sales**
1. [Company or person] — [one specific next action to move the deal]
2. [Company or person] — [one specific next action]
3. [Company or person] — [one specific next action]
4. [Company or person] — [one specific next action]

**Delivery**
1. [Client name] — [one specific next action on work already sold]
2. [Client name] — [one specific next action]
3. [Client name] — [one specific next action]

**Campaign To-Do**
• [The single most relevant seasonal or campaign action for right now — one line]

**Other**
[1–2 sentences flagging anything else worth noting — stale data, an upcoming deadline, a quick win, or new Quick Builder inquiries awaiting review (by name).]

---

RULES:
- Each to-do is ONE line: name + action only. No sub-bullets, no explanations.
- THE LINE BETWEEN SECTIONS IS ABSOLUTE: **Sales** is for deals not yet won — open proposals, leads, partners, meetings needing follow-up. **Delivery** is ONLY for clients with an ACCEPTED proposal — sessions, presenters, assessments, recordings, boxes. Never put a client with an unaccepted proposal in Delivery; they are still being sold to.
- Lead Sales with the biggest thing at risk — largest dollar value or longest stalled.
- Do not confuse a meeting with a delivery. A workshop, class, challenge or presentation is delivery; a 1:1, discovery or networking call is sales.
- If a section has fewer real items than the slots above, write as many as the data supports — do not invent names.
- Mention follow-up counts in the opening if notable; do NOT list individual follow-ups — they are shown separately.
- Do NOT write a Renewal section — it is rendered separately. You may reference renewal highlights in the opening.
- Total output should be under 320 words.

DATA (use this — do not repeat it verbatim):

Today: ${todayStr}
${currentMonthName} themes: ${currentThemes.slice(0,2).join(', ')}

Active campaigns: ${triggeredCampaigns.length > 0 ? triggeredCampaigns.map(t => `${t.campaign.name} (${t.label})`).join('; ') : 'none'}

Clients in 90-day renewal window: ${clients.filter(c => {
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

Active partners total: ${activePartnerCount}
Active clients total: ${activeClientCount}

New Quick Builder inquiries (awaiting first contact): ${newInquiries.slice(0,5).map(l => l.name + (l.company ? ' at ' + l.company : '') + ' (team: ' + (l.company_size || '?') + ', ' + (l.quickbuilder_selections?.length || 0) + ' services selected, submitted: ' + (l.created_date ? new Date(l.created_date).toLocaleDateString() : 'recently') + ')').join('; ') || 'none'}

GLOBAL CONTEXT (service catalog, pipeline counts, renewal season):
${globalContext}

KNOWLEDGE BASE (sales process + delivery):
${knowledgeText}

DELIVERY INTELLIGENCE:
Today/tomorrow sessions (${delivery.todayTomorrowCount || 0}): ${delivery.todayTomorrowSessions?.map(s => `${s.title} — ${s.start} (${s.client || 'no client'}${s.completed ? ', ✓done' : ''}${s.presenterAccepted ? '' : ', presenter NOT accepted'})`).join('; ') || 'none'}
Presenter-acceptance gaps (${delivery.presenterGapCount || 0}): ${delivery.presenterGapSessions?.map(s => `${s.title} (${s.client || 'no client'}, ${s.status})`).join('; ') || 'none'}
Challenges missing assessments: ${delivery.challengeAssessmentGaps?.map(g => `${g.client} (missing ${g.missing} of the cohort assessment)`).join('; ') || 'none'}
Unscheduled services: ${delivery.unscheduledServicesTotal || 0} across ${delivery.clientsWithDelivery || 0} client(s)
${delivery.activeCohort ? `Renewal ramp active: ${delivery.activeCohort.label} cohort, ${delivery.activeCohort.daysRemaining} days remaining. Clients without booked reviews: ${delivery.renewalReviewGaps?.slice(0,8).map(g => `${g.client} (${g.daysRemaining}d, owner: ${g.owner})`).join('; ') || 'none'}` : 'No active renewal ramp.'}

Open follow-up reminders: ${openReminders.length} (${overdueReminders} overdue 3+ days)`;

  let briefing;
  try {
    briefing = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });
  } catch (err) {
    console.error('[mayaDailyBriefing] LLM call failed:', err.message, err.stack);
    const clientItems = silentClients.slice(0,3).map((c,i) => `${i+1}. ${c.company || c.name} — Re-engage, last contact ${c.last_contacted_date || 'unknown'}`).join('\n') || '1. Review client pipeline';
    const partnerItems = overduePartners.slice(0,3).map((l,i) => `${i+1}. ${l.name} — Follow up (overdue ${l.follow_up_due_date})`).join('\n') || '1. Review partner pipeline';
    const campaignItem = triggeredCampaigns.length > 0 ? `• ${triggeredCampaigns[0].campaign.name} — ${triggeredCampaigns[0].label}` : `• Review ${currentMonthName} seasonal themes`;
    briefing = `Today is ${todayStr}. ${stats.silent_clients} clients need re-engagement and ${stats.overdue_partners} partner follow-ups are overdue. Start with your most at-risk client relationship.\n\n**Client To-Dos**\n${clientItems}\n\n**Partner To-Dos**\n${partnerItems}\n\n**Campaign To-Do**\n${campaignItem}\n\n**Other**\n${stats.renewal_clients} client(s) are in their 90-day renewal window.\n\n_Maya hit an upstream error (${err.message || 'timeout'}) — refresh to regenerate._`;
  }

  const warningPrefix = contextWarnings.length > 0 ? contextWarnings.join('\n') + '\n\n' : '';

  const deliverySnapshot = {
    todayTomorrowSessions: delivery.todayTomorrowSessions || [],
    presenterGapSessions: delivery.presenterGapSessions || [],
    challengeAssessmentGaps: delivery.challengeAssessmentGaps || [],
    unscheduledServicesTotal: delivery.unscheduledServicesTotal || 0,
    clientsWithDelivery: delivery.clientsWithDelivery || 0,
    activeCohort: delivery.activeCohort || null,
    renewalReviewGaps: delivery.renewalReviewGaps || [],
  };

  return Response.json({
    briefing: warningPrefix + briefing,
    generated_at: now.toISOString(),
    stats,
    follow_ups: openReminders,
    delivery_snapshot: deliverySnapshot,
  });
});