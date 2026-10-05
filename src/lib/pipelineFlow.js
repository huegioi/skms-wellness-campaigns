/**
 * pipelineFlow — how Clients and Partner leads map onto the Flow (Sankey) view:
 * Source → Current stage → Outcome.
 *
 * Everything here reads a record's CURRENT fields. Nothing is written.
 */
import { CLIENT_STAGES } from '@/components/shared/constants';
import { normalizeLeadStatus } from '@/lib/statusConfig';

// Status colors (reserved — always paired with a text label in the chart).
const GOOD = '#0ca30c';
const WARNING = '#fab219';
const CRITICAL = '#d03b3b';
const NEUTRAL_LIGHT = '#c3c2b7';
const ACTIVE = '#2a78d6';

const money = n => `$${Math.round(n).toLocaleString()}`;

// ── Clients ──────────────────────────────────────────────────────────────────

const CLIENT_STAGE_LABEL = Object.fromEntries(CLIENT_STAGES.map(s => [s.key, s.label]));
const CLIENT_STAGE_GROUP = Object.fromEntries(CLIENT_STAGES.map(s => [s.key, s.group]));
const ACTIVE_LIFECYCLE = new Set(['new_client_setup', 'program_delivery', 'followup_feedback', 'nurture', 'renewal_outreach']);

export const CLIENT_STAGE_ORDER = CLIENT_STAGES.map(s => s.key);

export const CLIENT_OUTCOMES = [
  { key: 'in_sales', label: 'In sales',      color: ACTIVE },
  { key: 'active',   label: 'Active client', color: GOOD },
  { key: 'at_risk',  label: 'At risk',       color: WARNING },
  { key: 'lost',     label: 'Lost',          color: CRITICAL },
  { key: 'unstaged', label: 'No stage yet',  color: NEUTRAL_LIGHT },
];

function clientSource(c) {
  if (c.referral_partner_id || c.referral_partner_name) return { key: 'partner', label: 'Partner referral' };
  if (c.brokerage_id || c.broker_name || c.broker_email || (Array.isArray(c.brokers) && c.brokers.length)) return { key: 'broker', label: 'Via broker' };
  if (c.wellness_consultant_name || c.wellness_consultant_email) return { key: 'consultant', label: 'Via consultant' };
  if (c.is_assessment_lead) return { key: 'assessment', label: 'Assessment / Journey' };
  return { key: 'direct', label: 'Direct' };
}

function clientOutcomeKey(stage) {
  if (!stage) return 'unstaged';
  if (stage === 'churned') return 'lost';
  if (stage === 're_engage') return 'at_risk';
  if (ACTIVE_LIFECYCLE.has(stage)) return 'active';
  if (CLIENT_STAGE_GROUP[stage] === 'Sales') return 'in_sales';
  return 'unstaged';
}

export function classifyClient(c) {
  const stageKey = c.client_stage || '__none__';
  return {
    source: clientSource(c),
    stage: { key: stageKey, label: CLIENT_STAGE_LABEL[stageKey] || stageKey },
    outcome: { key: clientOutcomeKey(c.client_stage) },
  };
}

export const CLIENT_METRICS = [
  { key: 'count', label: 'Count', value: () => 1 },
  { key: 'revenue', label: 'Invoiced $', value: c => Number(c.total_invoice_value) || 0, format: money },
];

// ── Partner leads (Partners page — Lead entity) ──────────────────────────────

// Mirrors PipelineView: these follow_up_stage values live on the Engagement board.
const ENGAGEMENT_SET = new Set([
  'New Referral Partner', 'Lunch & Learn', 'Active & Engaged',
  'In-Person Meeting', 'In-Person Lunch', 'Quarterly Review',
  'Renewal Season Outreach', 'Re-engage Partner', 'Inactive',
]);
const OVERLAP_STAGES = new Set(['In-Person Meeting', 'In-Person Lunch']);

export function isEngagementLead(lead) {
  const stage = lead.follow_up_stage || '';
  if (!ENGAGEMENT_SET.has(stage)) return false;
  if (OVERLAP_STAGES.has(stage)) return lead.partner_status === 'active_partner';
  return true;
}

export const LEAD_STAGE_ORDER = ['cold', 'contacted', 'in_conversation', 'meeting_scheduled', 'proposal_sent', 'engagement', 'closed'];
const LEAD_STAGE_LABEL = {
  cold: 'New', contacted: 'Contacted', in_conversation: 'In Conversation',
  meeting_scheduled: 'Meeting Scheduled', proposal_sent: 'Proposal Sent',
  engagement: 'Engagement board', closed: 'Closed',
};

export const LEAD_OUTCOMES = [
  { key: 'open',           label: 'Still in outreach', color: ACTIVE },
  { key: 'active_partner', label: 'Active partner',    color: GOOD },
  { key: 'won',            label: 'Won',               color: GOOD },
  { key: 'cooling',        label: 'Inactive',          color: WARNING },
  { key: 'not_now',        label: 'Not now',           color: CRITICAL },
];

const titleCase = s => s.replace(/\s+/g, ' ').trim().replace(/\b\w/g, ch => ch.toUpperCase());

function leadSource(lead) {
  const raw = String(lead.source || '').trim();
  const s = raw.toLowerCase();
  if (lead.lead_type === 'company_inquiry' || /quick ?builder/.test(s)) return { key: 'quickbuilder', label: 'QuickBuilder' };
  if (/referr/.test(s)) return { key: 'referral', label: 'Referral' };
  if (/linked ?in/.test(s)) return { key: 'linkedin', label: 'LinkedIn' };
  if (/podcast/.test(s)) return { key: 'podcast', label: 'Podcast' };
  if (/nabip|event|conference|summit|expo|card|scan|lunch|meetup|network/.test(s)) return { key: 'events', label: 'Events & networking' };
  if (/sheet|import|csv|list/.test(s) || (!s && lead.sheet_origin)) return { key: 'sheet', label: 'Sheet import' };
  if (s) return { key: `src:${s}`, label: titleCase(raw).slice(0, 28) };
  return { key: 'unknown', label: 'Not recorded' };
}

export function classifyLead(lead) {
  let stageKey;
  let outcomeKey;
  if (isEngagementLead(lead)) {
    stageKey = 'engagement';
    outcomeKey = lead.follow_up_stage === 'Inactive' || lead.partner_status === 'inactive' ? 'cooling' : 'active_partner';
  } else {
    const status = normalizeLeadStatus(lead.status);
    if (status === 'converted' || status === 'current_client') { stageKey = 'closed'; outcomeKey = 'won'; }
    else if (status === 'not_interested') { stageKey = 'closed'; outcomeKey = 'not_now'; }
    else {
      stageKey = LEAD_STAGE_LABEL[status] ? status : 'cold';
      outcomeKey = lead.partner_status === 'active_partner' ? 'active_partner'
        : lead.partner_status === 'inactive' ? 'cooling' : 'open';
    }
  }
  return {
    source: leadSource(lead),
    stage: { key: stageKey, label: LEAD_STAGE_LABEL[stageKey] },
    outcome: { key: outcomeKey },
  };
}

export const LEAD_METRICS = [
  { key: 'count', label: 'Count', value: () => 1 },
  { key: 'referrals', label: 'Referrals sent', value: l => Number(l.referral_count) || 0, format: n => `${n} referral${n === 1 ? '' : 's'}` },
];
