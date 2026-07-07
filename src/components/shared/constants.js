/**
 * Shared constants for owners and stage lists.
 * Used by pipeline views, inline controls, and RecordSnapshotHeader.
 */

export const OWNERS = ['William', 'Heather'];

// ── Lead follow-up stages (maps to Lead.follow_up_stage) ─────────────────────
// Deduplicated: "In-Person Meeting" and "In-Person Lunch" appear in Acquisition only.
const LEAD_ACQUISITION = [
  'Event Follow-up',
  'Day 1 - LinkedIn Connection',
  'Day 2 - Send email #1',
  'Day 3 - Call #1',
  'Day 3 - Text f/u to call',
  'Day 5 - Call #2',
  'Day 5 - LinkedIn f/u message',
  'Day 7 - Send email #2',
  'Day 10 - Call #3',
  'Day 10 - Send email #3',
  'Day 11 - LinkedIn message #3',
  'Day 15 - Send email #4',
  'Day 20 - Send email #5',
  'In-Person Meeting',
  'In-Person Lunch',
  'Podcast',
  'Podcast Follow-up',
  'NABIP ?',
  'NABIP Yes',
  'NABIP No',
];

const LEAD_ENGAGEMENT = [
  'New Referral Partner',
  'Lunch & Learn',
  'Active & Engaged',
  'Quarterly Review',
  'Renewal Season Outreach',
  'Re-engage Partner',
  'Inactive',
];

export const LEAD_STAGES = [
  ...LEAD_ACQUISITION.map(s => ({ key: s, label: s, group: 'Acquisition' })),
  ...LEAD_ENGAGEMENT.map(s => ({ key: s, label: s, group: 'Engagement' })),
];

// ── Lead status pipeline (maps to Lead.status) ───────────────────────────────
export const LEAD_STATUS_STAGES = [
  { key: 'cold',              label: 'New',                group: 'Pipeline' },
  { key: 'contacted',         label: 'Contacted',          group: 'Pipeline' },
  { key: 'in_conversation',  label: 'In Conversation',   group: 'Pipeline' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled',  group: 'Pipeline' },
  { key: 'proposal_sent',    label: 'Proposal Sent',      group: 'Pipeline' },
  { key: 'converted',        label: 'Won — Converted',     group: 'Closed' },
  { key: 'current_client',   label: 'Won — Current Client', group: 'Closed' },
  { key: 'not_interested',   label: 'Not Now',            group: 'Closed' },
];

// ── Client stages (maps to Client.client_stage) ──────────────────────────────
export const CLIENT_STAGES = [
  // Sales pipeline
  { key: 'event_follow_up',          label: 'Event Follow-up',           group: 'Sales',     desc: 'Following up after an event, conference, or speaking engagement',  headerClass: 'bg-cyan-50 border-cyan-200',     textClass: 'text-cyan-700' },
  { key: 'discovery_call_scheduled', label: 'Discovery Call Scheduled',  group: 'Sales',     desc: 'Call booked, preparing for first conversation',                   headerClass: 'bg-sky-50 border-sky-200',       textClass: 'text-sky-700' },
  { key: 'discovery_call_complete',  label: 'Discovery Call Complete',   group: 'Sales',     desc: 'Call done, assessing fit and next steps',                          headerClass: 'bg-cyan-50 border-cyan-200',     textClass: 'text-cyan-700' },
  { key: 'proposal_sent',            label: 'Proposal Sent',             group: 'Sales',     desc: 'Proposal delivered, awaiting response',                            headerClass: 'bg-indigo-50 border-indigo-200', textClass: 'text-indigo-700' },
  { key: 'proposal_viewed',          label: 'Proposal Viewed',           group: 'Sales',     desc: 'Prospect opened the proposal — act fast',                          headerClass: 'bg-violet-50 border-violet-200', textClass: 'text-violet-700' },
  { key: 'negotiation',              label: 'Negotiation',               group: 'Sales',     desc: 'Active back-and-forth on scope and pricing',                        headerClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' },
  { key: 'verbal_yes',               label: 'Verbal Yes',                group: 'Sales',     desc: 'Commitment received — closing the deal',                           headerClass: 'bg-blue-50 border-blue-300',     textClass: 'text-blue-800' },
  // Lifecycle
  { key: 'new_client_setup',         label: 'New Client Setup',          group: 'Lifecycle', desc: 'Completing onboarding tasks, scheduling first programs',           headerClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' },
  { key: 'program_delivery',         label: 'Program Delivery',          group: 'Lifecycle', desc: 'Actively delivering workshops, challenges, boxes',                 headerClass: 'bg-green-50 border-green-200',   textClass: 'text-green-700' },
  { key: 'followup_feedback',        label: 'Follow-up & Feedback',      group: 'Lifecycle', desc: 'Collecting surveys, building ROI reports',                        headerClass: 'bg-teal-50 border-teal-200',     textClass: 'text-teal-700' },
  { key: 'nurture',                  label: 'Nurture',                   group: 'Lifecycle', desc: 'Between programs, maintaining relationship',                      headerClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' },
  { key: 'renewal_outreach',         label: 'Renewal Outreach',          group: 'Lifecycle', desc: "Approaching plan year renewal, proposing next year's programs",    headerClass: 'bg-amber-50 border-amber-300',   textClass: 'text-amber-700' },
  { key: 're_engage',                label: 'Re-engage',                 group: 'Lifecycle', desc: 'Gone quiet for 60+ days, need proactive outreach',                headerClass: 'bg-red-50 border-red-300',       textClass: 'text-red-700' },
  { key: 'churned',                  label: 'Churned',                   group: 'Lifecycle', desc: 'Lost client',                                                     headerClass: 'bg-rose-100 border-rose-300',    textClass: 'text-rose-700' },
  { key: '__none__',                 label: 'No Stage',                  group: 'Lifecycle', desc: 'Clients with no stage set yet',                                   headerClass: 'bg-slate-50 border-slate-200',   textClass: 'text-slate-500' },
];

// ── Partner stages (maps to ReferralPartner.partner_status) ──────────────────
export const PARTNER_STAGES = [
  { key: 'Prospect',       label: 'Prospect',        group: 'Status', desc: 'Identified, outreach not yet started',   headerClass: 'bg-sky-50 border-sky-200',        textClass: 'text-sky-700',    staleThreshold: 14 },
  { key: 'Active Partner', label: 'Active Partner',  group: 'Status', desc: 'Agreement signed, actively referring',    headerClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700', staleThreshold: 30 },
  { key: 'Inactive',       label: 'Inactive',        group: 'Status', desc: 'No recent referrals or engagement',       headerClass: 'bg-gray-100 border-gray-300',     textClass: 'text-gray-500',   staleThreshold: null },
  { key: '__none__',       label: 'No Stage',        group: 'Status', desc: 'Partners with no stage set yet',          headerClass: 'bg-slate-50 border-slate-200',    textClass: 'text-slate-500',  staleThreshold: null },
];