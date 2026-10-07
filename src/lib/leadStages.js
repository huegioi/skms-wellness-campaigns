/**
 * Partner-lead pipeline stages — the ONE definition of the stage set.
 *
 * Mirrored in base44/shared/leadStages.ts (Deno functions). Keep the two in sync.
 *
 * Stored in Lead.status. Existing keys were KEPT (cold, contacted, in_conversation,
 * meeting_scheduled, not_interested) and only relabeled, so the Google Sheet sync,
 * campaign audiences and referral workflows keep working. New keys: met, onboarding,
 * active_partner, not_a_fit. Legacy values are normalized on read:
 *   responded     → in_conversation
 *   proposal_sent → onboarding   (brokers don't buy; "proposal" meant the partner agreement)
 *   converted / current_client stay valid — used by company-inquiry leads that became clients.
 */

export const LEAD_STAGE_DEFS = [
  { key: 'cold',              label: 'To contact',     group: 'Open',   nextDays: null, staleDays: 14, desc: 'Not reached yet' },
  { key: 'contacted',         label: 'In sequence',    group: 'Open',   nextDays: 3,    staleDays: 21, desc: 'Outreach under way, no reply yet' },
  { key: 'in_conversation',   label: 'Talking',        group: 'Open',   nextDays: 2,    staleDays: 7,  desc: 'They replied — a real conversation' },
  { key: 'meeting_scheduled', label: 'Meeting booked', group: 'Open',   nextDays: null, staleDays: 14, desc: 'A meeting is on the calendar' },
  { key: 'met',               label: 'Met — next step',group: 'Open',   nextDays: 7,    staleDays: 14, desc: 'Meeting held; next step agreed' },
  { key: 'onboarding',        label: 'Onboarding',     group: 'Open',   nextDays: 7,    staleDays: 21, desc: 'Agreement sent or signed, portal sent' },
  { key: 'active_partner',    label: 'Active partner', group: 'Won',    nextDays: 30,   staleDays: null, desc: 'First approved referral' },
  { key: 'not_interested',    label: 'Not now',        group: 'Closed', nextDays: null, staleDays: null, desc: 'Parked — revisit later' },
  { key: 'not_a_fit',         label: 'Not a fit',      group: 'Closed', nextDays: null, staleDays: null, desc: 'Closed for good' },
];

/** Values that stay valid in the enum but are not partner pipeline stages. */
export const CLIENT_WIN_STATUSES = ['converted', 'current_client'];

export const LEAD_STAGE_ORDER = LEAD_STAGE_DEFS.map(s => s.key);
export const LEAD_STAGE_BY_KEY = Object.fromEntries(LEAD_STAGE_DEFS.map(s => [s.key, s]));

/** Before a real conversation — these follow-ups are grouped, not individual. */
export const PRE_TALKING_STAGES = new Set(['cold', 'contacted']);
/** Out of the active pipeline: no follow-up nags, excluded from "all partners" audiences. */
export const CLOSED_STAGES = new Set(['not_interested', 'not_a_fit', 'converted', 'current_client']);
/** Counts as a win. */
export const WON_STAGES = new Set(['active_partner', 'converted', 'current_client']);

export const MEETING_OUTCOMES = [
  { key: 'held', label: 'Held' },
  { key: 'no_show', label: 'No-show' },
  { key: 'rescheduled', label: 'Rescheduled' },
];

export const SOURCE_TYPES = [
  { key: 'event',        label: 'Event / conference' },
  { key: 'linkedin',     label: 'LinkedIn' },
  { key: 'referral',     label: 'Referral' },
  { key: 'podcast',      label: 'Podcast' },
  { key: 'cold_list',    label: 'Cold list / sheet' },
  { key: 'inbound',      label: 'Inbound (they reached out)' },
  { key: 'quickbuilder', label: 'QuickBuilder' },
  { key: 'other',        label: 'Other' },
];

export function normalizeStage(status) {
  if (status === 'responded') return 'in_conversation';
  if (status === 'proposal_sent') return 'onboarding';
  return status || 'cold';
}

export function stageLabel(status) {
  const k = normalizeStage(status);
  if (k === 'converted' || k === 'current_client') return 'Won — client';
  return LEAD_STAGE_BY_KEY[k]?.label || k.replace(/_/g, ' ');
}

/** Position in the pipeline; closed/unknown sort last. Used to never auto-downgrade. */
export function stageRank(status) {
  const k = normalizeStage(status);
  const i = LEAD_STAGE_ORDER.indexOf(k);
  if (CLIENT_WIN_STATUSES.includes(k)) return LEAD_STAGE_ORDER.indexOf('active_partner');
  return i === -1 ? -1 : i;
}

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Default next follow-up date when a lead lands in a stage (null = leave as is / none). */
export function defaultNextFollowup(stage, at = new Date(), extra = {}) {
  const k = normalizeStage(stage);
  if (k === 'not_interested') return extra.revisit_date || isoDay(addDays(at, 90));
  if (k === 'meeting_scheduled' && extra.meetingDate) return isoDay(addDays(extra.meetingDate, 1));
  const days = LEAD_STAGE_BY_KEY[k]?.nextDays;
  return days == null ? null : isoDay(addDays(at, days));
}

/**
 * Build the Lead update for a stage change. Every writer should use this so the
 * stage date, history and next follow-up stay consistent.
 *   by: 'William' | 'Heather' | 'auto' | 'sheet'   reason: short text (auto moves)
 */
export function buildStageChange(lead, toStatus, { by = 'manual', reason = '', at = new Date(), extra = {} } = {}) {
  const from = normalizeStage(lead?.status);
  const to = normalizeStage(toStatus);
  if (from === to) return {};
  const when = new Date(at);
  const history = Array.isArray(lead?.stage_history) ? lead.stage_history.slice(-49) : [];
  history.push({ from, to, at: when.toISOString(), by, ...(reason ? { reason } : {}) });
  const patch = { status: to, stage_entered_date: isoDay(when), stage_history: history };
  const next = defaultNextFollowup(to, when, extra);
  if (next) patch.next_followup_date = next;
  if (CLOSED_STAGES.has(to) && to !== 'not_interested') patch.next_followup_date = null;
  if (to === 'not_interested' && !lead?.revisit_date) patch.revisit_date = next;
  if (to === 'active_partner') patch.partner_status = 'active_partner';
  return patch;
}

/** Best-guess source category from the free-text source / tags (used to backfill). */
export function inferSourceType(lead) {
  const s = String(lead?.source || '').toLowerCase();
  const tags = (lead?.tags || []).map(t => String(t).toLowerCase());
  if (lead?.lead_type === 'company_inquiry' || /quick ?builder/.test(s)) return 'quickbuilder';
  if (/referr/.test(s)) return 'referral';
  if (/podcast/.test(s) || tags.some(t => t.includes('podcast'))) return 'podcast';
  if (/conference|nabip|neebc|itc|rosetta|hvba|wwcma|event|workshop|card|scan/.test(s)) return 'event';
  if (/linked ?in/.test(s)) return 'linkedin';
  if (tags.some(t => /nabip|neebc|itc|rosetta|hvba|wwcma|conference|workshop|20\d\d/.test(t))) return 'event';
  if (/sheet|import|csv|list/.test(s) || (!s && lead?.sheet_origin)) return 'cold_list';
  return s ? 'other' : null;
}

// Tags that describe a record rather than where it came from — never a follow-up group.
export const NON_COHORT_TAGS = new Set([
  'primary contact record', 'secondary record', 'active & engaged', 'lunch & learn',
  'new referral partner', 'event follow-up', 'demo', 'tpa', 'podcast',
]);

/** The cohort (usually the event) a lead belongs to, for grouped follow-ups. */
export function cohortOf(lead) {
  for (const t of lead?.tags || []) {
    if (t && !NON_COHORT_TAGS.has(String(t).toLowerCase())) return String(t);
  }
  return null;
}

/** "Day 3 - Call #1" style cadence step from the legacy follow_up_stage, for a card chip. */
export function cadenceStep(lead) {
  const s = lead?.follow_up_stage || '';
  return /^Day\s*\d+/i.test(s) ? s : null;
}
