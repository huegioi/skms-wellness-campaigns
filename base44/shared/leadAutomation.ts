// @ts-nocheck
/**
 * Evidence-based partner-lead stage moves — pure logic (no I/O) so it can be tested.
 * Used by functions/advanceLeadStages.
 *
 * Rules (FORWARD ONLY — a lead is never moved backwards, closed/won leads are never
 * touched, and nothing is ever sent to anyone):
 *   outbound email or campaign email sent      → In sequence      (contacted)
 *   inbound email (a real reply) / campaign reply → Talking       (in_conversation)
 *   a meeting with them on the calendar         → Meeting booked   (meeting_scheduled)
 *   that meeting's time has passed (≤60 days)   → Met — next step  (met; Maya asks for the outcome)
 *   first approved referral from them           → Active partner   (active_partner)
 * Plus housekeeping on every run:
 *   stage_entered_date missing → filled from last contact / record date (no history entry)
 *   source_type missing        → best guess from the free-text source / tags
 */
import {
  buildStageChange, normalizeStage, stageRank, inferSourceType, CLOSED_STAGES, WON_STAGES,
} from './leadStages.ts';

const AUTO_REPLY = /out of (the )?office|automatic reply|auto-?reply|autoreply|undeliverable|delivery status|mail delivery|away from|on vacation|returned mail/i;
const APPROVED_REFERRAL = new Set(['submitted', 'contacted', 'converted_to_client', 'purchased', 'commission_paid']);
const NON_MEETING_TYPES = new Set(['delivery', 'workshop', 'challenge', 'class', 'leadership']);
const MET_WINDOW_DAYS = 60;
const MEETING_ENDED_GRACE_MS = 2 * 3600 * 1000;

const day = (d) => new Date(d).toISOString().slice(0, 10);
const lower = (s) => String(s || '').trim().toLowerCase();

export function planLeadStageMoves({ leads, emails = [], events = [], recipients = [], referrals = [], partners = [], now = new Date() }) {
  const nowMs = new Date(now).getTime();

  // ── Index evidence by lead ────────────────────────────────────────────
  const out = {};   // leadId → latest outbound date
  const inb = {};   // leadId → latest real inbound date
  for (const e of emails) {
    if (!e.matched_lead_id || e.is_draft || !e.date) continue;
    if (e.direction === 'outbound') {
      if (!out[e.matched_lead_id] || e.date > out[e.matched_lead_id]) out[e.matched_lead_id] = e.date;
    } else if (e.direction === 'inbound') {
      if (AUTO_REPLY.test(`${e.subject || ''} ${e.snippet || ''}`)) continue;
      if (!inb[e.matched_lead_id] || e.date > inb[e.matched_lead_id]) inb[e.matched_lead_id] = e.date;
    }
  }
  for (const r of recipients) {
    if (r.record_type !== 'lead' || !r.record_id) continue;
    if (r.status === 'replied') {
      const d = r.replied_at || r.sent_at || r.updated_date;
      if (d && (!inb[r.record_id] || d > inb[r.record_id])) inb[r.record_id] = d;
    }
    if (r.status === 'sent' || r.status === 'replied') {
      const d = r.sent_at || r.updated_date;
      if (d && (!out[r.record_id] || d > out[r.record_id])) out[r.record_id] = d;
    }
  }
  const nextMeeting = {};  // leadId → soonest future meeting start
  const lastMeeting = {};  // leadId → latest ended meeting start (within window)
  for (const ev of events) {
    if (!ev.lead_id || !ev.start_date || ev.is_demo) continue;
    if (NON_MEETING_TYPES.has(ev.event_type)) continue;
    const start = new Date(ev.start_date).getTime();
    if (isNaN(start)) continue;
    const end = ev.end_date ? new Date(ev.end_date).getTime() : start + 3600 * 1000;
    if (start > nowMs) {
      if (!nextMeeting[ev.lead_id] || ev.start_date < nextMeeting[ev.lead_id]) nextMeeting[ev.lead_id] = ev.start_date;
    } else if (end + MEETING_ENDED_GRACE_MS <= nowMs && nowMs - start <= MET_WINDOW_DAYS * 86400000) {
      if (!lastMeeting[ev.lead_id] || ev.start_date > lastMeeting[ev.lead_id]) lastMeeting[ev.lead_id] = ev.start_date;
    }
  }
  const partnerEmailById = {};
  for (const p of partners) if (p.email) partnerEmailById[p.id] = lower(p.email);
  const firstReferralByEmail = {};
  for (const r of referrals) {
    if (r.is_demo || !APPROVED_REFERRAL.has(r.status)) continue;
    const em = partnerEmailById[r.referral_partner_id];
    if (!em) continue;
    const d = r.reviewed_date || r.referral_date || r.created_date;
    if (!firstReferralByEmail[em] || (d && d < firstReferralByEmail[em])) firstReferralByEmail[em] = d || day(now);
  }

  // ── Decide per lead ───────────────────────────────────────────────────
  const moves = [];
  for (const lead of leads) {
    if (lead.is_demo || lead.is_archived || lead.lead_type !== 'broker_lead') continue;
    const current = normalizeStage(lead.status);
    const patch = {};
    let reason = '';

    // Housekeeping (no history entry)
    if (!lead.stage_entered_date) {
      patch.stage_entered_date = day(lead.last_contacted_date || lead.updated_date || lead.created_date || now);
    }
    if (!lead.source_type) {
      const guess = inferSourceType(lead);
      if (guess) patch.source_type = guess;
    }

    const frozen = lead.auto_stage_paused || CLOSED_STAGES.has(current) || WON_STAGES.has(current);
    if (!frozen) {
      // Strongest evidence wins; each candidate is [stage, evidenceDate, reason, extra]
      const cands = [];
      const refDate = firstReferralByEmail[lower(lead.email)];
      if (refDate) cands.push(['active_partner', refDate, 'first referral approved']);
      if (lastMeeting[lead.id]) cands.push(['met', lastMeeting[lead.id], 'meeting time passed']);
      if (nextMeeting[lead.id]) cands.push(['meeting_scheduled', now, 'meeting on the calendar', { meetingDate: nextMeeting[lead.id] }]);
      if (inb[lead.id]) cands.push(['in_conversation', inb[lead.id], 'they replied by email']);
      if (out[lead.id]) cands.push(['contacted', out[lead.id], 'outreach email sent']);

      // A manual stage change beats any evidence older than it (e.g. a no-show moved back
      // to Talking must not be pushed to "Met" again by the same past meeting).
      const lastManualAt = Math.max(0, ...(lead.stage_history || [])
        .filter(h => h && h.by !== 'auto' && h.at)
        .map(h => new Date(h.at).getTime()));
      const fresh = cands.filter(c => c[0] === 'meeting_scheduled' || new Date(c[1]).getTime() > lastManualAt);

      let best = null;
      for (const c of fresh) if (!best || stageRank(c[0]) > stageRank(best[0])) best = c;
      if (best && stageRank(best[0]) > stageRank(current)) {
        const at = new Date(best[1]).getTime() > nowMs ? now : new Date(best[1]);
        Object.assign(patch, buildStageChange(lead, best[0], { by: 'auto', reason: best[2], at, extra: best[3] || {} }));
        // Old evidence (first run over history) records the stage but must not create a
        // wave of new follow-up dates; recent evidence gets a date that is never in the past.
        const evidenceAgeDays = (nowMs - new Date(at).getTime()) / 86400000;
        if (evidenceAgeDays > 30) {
          delete patch.next_followup_date;
        } else if (patch.next_followup_date && patch.next_followup_date < day(now)) {
          const fresh = buildStageChange({ ...lead, status: current }, best[0], { by: 'auto', at: now, extra: best[3] || {} });
          if (fresh.next_followup_date) patch.next_followup_date = fresh.next_followup_date;
        }
        reason = best[2];
      }
    }
    if (Object.keys(patch).length) moves.push({ lead, patch, reason, from: current, to: patch.status || current });
  }
  return moves;
}
