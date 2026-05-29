import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SEASONAL_FLAGS = {
  1: "New year kickoff — fresh budgets, propose new programs",
  3: "Share case studies and ROI data with partners",
  5: "Mental Health Month — offer co-branded campaigns to partners and clients",
  8: "Pre-renewal planning for summer renewals",
  10: "Renewal push for January plan years",
  11: "Thank you outreach and year-end relationship building",
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  // Fetch data in parallel using service role (works for automations & UI)
  const [allLeads, allClients] = await Promise.all([
    base44.asServiceRole.entities.Lead.filter({ lead_type: 'broker_lead' }),
    base44.asServiceRole.entities.Client.list(),
  ]);

  // Overdue partners: follow_up_due_date is in the past
  const overduePartners = allLeads.filter(l =>
    l.follow_up_due_date && new Date(l.follow_up_due_date) < now
  );

  // Active partners
  const activePartners = allLeads.filter(l => l.partner_status === 'active_partner');

  // Silent clients: last_contacted_date older than 60 days (or never contacted)
  const silentClients = allClients.filter(c => {
    if (!c.last_contacted_date) return true;
    const msAgo = now - new Date(c.last_contacted_date);
    return msAgo > 60 * 24 * 60 * 60 * 1000;
  });

  // Renewal clients: plan_year_start within the next 90 days (rolling year)
  const renewalClients = allClients.filter(c => {
    if (!c.plan_year_start) return false;
    const planDate = new Date(c.plan_year_start);
    let candidate = new Date(now.getFullYear(), planDate.getMonth(), planDate.getDate());
    if (candidate < now) {
      candidate = new Date(now.getFullYear() + 1, planDate.getMonth(), planDate.getDate());
    }
    const daysUntil = (candidate - now) / (1000 * 60 * 60 * 24);
    return daysUntil >= 0 && daysUntil <= 90;
  });

  const seasonalFlag = SEASONAL_FLAGS[currentMonth] || null;

  const prompt = `You are Maya, the Sales Director at SKMS Wellness — a mental fitness campaign company that helps organizations through workshops, 14-day challenges, leadership programs, wellness boxes, and classes. You report to William and Heather, the co-founders.

Your job is to give a concise, actionable daily briefing every morning. You are direct, warm, and strategic. You prioritize revenue-generating activities and relationship maintenance.

SKMS sells to companies through benefits broker referral partners. The business rhythm follows the benefits calendar: plans renew in January (prep in Oct/Nov) and July (prep in April/May). May is Mental Health Month — a key marketing moment.

When giving your briefing:
- Lead with the most urgent items (overdue follow-ups, at-risk clients)
- Be specific — use names, companies, and dates
- Suggest the exact next action, not vague advice
- Flag seasonal opportunities tied to the current month
- Keep it under 500 words
- Use a friendly but professional tone
- Group items by priority: Urgent, Important, Opportunities

Here is today's data:

Today is ${now.toDateString()}.

OVERDUE FOLLOW-UP PARTNERS (${overduePartners.length}):
${overduePartners.map(l => `- ${l.name} (${l.company || 'no company'}) | email: ${l.email} | stage: ${l.follow_up_stage || 'unknown'} | due: ${l.follow_up_due_date}`).join('\n') || 'None'}

ACTIVE PARTNERS (${activePartners.length}):
${activePartners.map(l => `- ${l.name} (${l.company || 'no company'}) | email: ${l.email} | referrals: ${l.referral_count || 0}`).join('\n') || 'None'}

CLIENTS NEEDING ATTENTION — no contact in 60+ days (${silentClients.length}):
${silentClients.map(c => `- ${c.company || c.name} | contact: ${c.name} | last contacted: ${c.last_contacted_date || 'never'} | owner: ${c.owner || 'unassigned'}`).join('\n') || 'None'}

CLIENTS IN RENEWAL WINDOW — plan year starts within 90 days (${renewalClients.length}):
${renewalClients.map(c => `- ${c.company || c.name} | plan year start: ${c.plan_year_start} | owner: ${c.owner || 'unassigned'}`).join('\n') || 'None'}

SEASONAL OPPORTUNITY THIS MONTH:
${seasonalFlag || 'No specific seasonal flag for this month.'}

Please give your daily briefing now.`;

  const stats = {
    overdue_partners: overduePartners.length,
    silent_clients: silentClients.length,
    renewal_clients: renewalClients.length,
    active_partners: activePartners.length,
  };

  let briefing;
  try {
    briefing = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });
  } catch (err) {
    briefing = `**Quick Summary:** ${stats.overdue_partners} overdue partner follow-up${stats.overdue_partners !== 1 ? 's' : ''}, ${stats.silent_clients} client${stats.silent_clients !== 1 ? 's' : ''} need attention, ${stats.renewal_clients} client${stats.renewal_clients !== 1 ? 's' : ''} in renewal window, ${stats.active_partners} active partner${stats.active_partners !== 1 ? 's' : ''}.\n\n_Full briefing unavailable — Maya timed out. Refresh to try again._`;
  }

  return Response.json({
    briefing,
    generated_at: now.toISOString(),
    stats,
  });
});