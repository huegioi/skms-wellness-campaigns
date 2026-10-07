// @ts-nocheck
/**
 * Runs the evidence-based stage check (rules: ./leadAutomation.ts) against the
 * database. Called right after the app learns something new:
 *   - updateLastContactedFromGmail  (Gmail connector trigger — as mail arrives)
 *   - scanAdminGmailContacts        (manual "Sync Emails" buttons)
 *   - updateLastContactedFromCalendar (every 15 min — meetings booked / ended)
 *   - syncCampaignSendStatus        (campaign email sent / replied)
 *   - reviewReferral                (referral approved)
 * …and once a night over every lead (advanceLeadStages, "Advance Lead Stages - Nightly").
 *
 * Forward-only, never touches closed/won/paused leads, never sends anything.
 * Every caller wraps this in try/catch — a failure here must never break a sync.
 */
import { planLeadStageMoves } from './leadAutomation.ts';

export async function runLeadStageAutomation(base44, { leadIds = null, extraEmails = [], dryRun = false } = {}) {
  const db = base44.asServiceRole.entities;
  if (Array.isArray(leadIds) && leadIds.length === 0 && !extraEmails.length) {
    return { leads_checked: 0, stage_moves: [], housekeeping_only: 0 };
  }

  let leads;
  if (Array.isArray(leadIds)) {
    const ids = [...new Set([...leadIds, ...extraEmails.map(e => e.matched_lead_id)].filter(Boolean))];
    leads = [];
    for (let i = 0; i < ids.length; i += 100) {
      leads.push(...(await db.Lead.filter({ id: { $in: ids.slice(i, i + 100) } }, '-created_date', 200) || []));
    }
  } else {
    leads = await db.Lead.filter({ lead_type: 'broker_lead', is_archived: { $ne: true } }, '-created_date', 2000);
  }
  leads = leads.filter(l => l.lead_type === 'broker_lead' && !l.is_archived && !l.is_demo);
  if (!leads.length) return { leads_checked: 0, stage_moves: [], housekeeping_only: 0 };

  const ids = leads.map(l => l.id);
  const emails = [...extraEmails];
  const events = [];
  const recipients = [];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const [em, ev, rc] = await Promise.all([
      db.EmailLog.filter({ matched_lead_id: { $in: part } }, '-date', 5000),
      db.CalendarEvent.filter({ lead_id: { $in: part } }, '-start_date', 2000),
      db.CampaignRecipient.filter({ record_type: 'lead', record_id: { $in: part } }, '-updated_date', 5000),
    ]);
    emails.push(...(em || []));
    events.push(...(ev || []));
    recipients.push(...(rc || []));
  }
  const [referrals, partners] = await Promise.all([
    db.Referral.list('-created_date', 2000),
    db.ReferralPartner.list('-created_date', 2000),
  ]);

  const moves = planLeadStageMoves({ leads, emails, events, recipients, referrals, partners, now: new Date() });
  const stageMoves = moves.filter(m => m.from !== m.to);

  if (!dryRun) {
    for (const m of moves) {
      await db.Lead.update(m.lead.id, m.patch);
    }
    // Keep the Google Sheet's Pipeline Stage column in step (best effort)
    for (const m of stageMoves) {
      await base44.asServiceRole.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updatePipelineStage',
        leadId: m.lead.id,
        email: m.lead.email,
        sheetRowId: m.lead.sheet_row_id,
        sheetName: m.lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners',
        status: m.to,
      }).catch(e => console.warn('[leadStages] sheet sync failed', m.lead.id, e?.message));
    }
  }

  return {
    leads_checked: leads.length,
    stage_moves: stageMoves.map(m => ({ id: m.lead.id, name: m.lead.name, company: m.lead.company, from: m.from, to: m.to, why: m.reason })),
    housekeeping_only: moves.length - stageMoves.length,
  };
}

/** Wrapper for sync functions: never throws, logs what moved. */
export async function advanceLeadsQuietly(base44, opts, label = '') {
  try {
    const r = await runLeadStageAutomation(base44, opts);
    if (r.stage_moves.length) console.log(`[leadStages${label ? ' ' + label : ''}] moved:`, JSON.stringify(r.stage_moves));
    return r;
  } catch (e) {
    console.warn(`[leadStages${label ? ' ' + label : ''}] stage check failed:`, e?.message);
    return null;
  }
}
