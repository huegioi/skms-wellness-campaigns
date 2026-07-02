/**
 * Canonical status configuration maps for leads, partners, referrals, and proposals.
 * Import these instead of declaring local copies.
 */
import { Clock, Send, Eye, CheckCircle, XCircle } from 'lucide-react';

// ── Lead outreach status (Lead.status) ────────────────────────────────────────
export const LEAD_STATUS_CONFIG = {
  cold:               { label: 'Cold',              color: 'bg-slate-100 text-slate-700 border-slate-300', chart: '#94a3b8' },
  contacted:          { label: 'Contacted',          color: 'bg-blue-100 text-blue-700 border-blue-300',   chart: '#3b82f6' },
  responded:          { label: 'Responded',          color: 'bg-purple-100 text-purple-700 border-purple-300', chart: '#a855f7' },
  meeting_scheduled:  { label: 'Meeting Scheduled',  color: 'bg-amber-100 text-amber-700 border-amber-300',  chart: '#f59e0b' },
  proposal_sent:      { label: 'Proposal Sent',      color: 'bg-orange-100 text-orange-700 border-orange-300', chart: '#f97316' },
  converted:          { label: 'Converted ✓',        color: 'bg-green-100 text-green-700 border-green-300',  chart: '#22c55e' },
  not_interested:     { label: 'Not Interested',     color: 'bg-red-100 text-red-700 border-red-300',       chart: '#ef4444' },
  current_client:     { label: 'Current Client',     color: 'bg-teal-100 text-teal-800 border-teal-400 font-semibold', chart: '#14b8a6' },
};

// ── Partner status (Lead.partner_status) ──────────────────────────────────────
export const PARTNER_STATUS_CONFIG = {
  new:            { label: 'New Lead',           color: 'bg-slate-100 text-slate-700 border-slate-300', chart: '#94a3b8' },
  nurturing:      { label: 'Nurturing',          color: 'bg-blue-100 text-blue-700 border-blue-300',   chart: '#3b82f6' },
  active_partner: { label: 'Active Partner',     color: 'bg-green-100 text-green-700 border-green-300', chart: '#22c55e' },
  inactive:       { label: 'Inactive',           color: 'bg-red-100 text-red-700 border-red-300',      chart: '#ef4444' },
};

// ── Referral status (Referral.status) ─────────────────────────────────────────
export const REFERRAL_STATUS_COLORS = {
  pending_review:       'bg-amber-100 text-amber-700',
  submitted:            'bg-blue-100 text-blue-700',
  contacted:            'bg-yellow-100 text-yellow-700',
  converted_to_client: 'bg-green-100 text-green-700',
  purchased:            'bg-emerald-100 text-emerald-700',
  commission_paid:      'bg-purple-100 text-purple-700',
  not_eligible:         'bg-gray-100 text-gray-600',
};

export const REFERRAL_STATUS_LABELS = {
  pending_review: 'Under Review',
  submitted: 'Submitted',
  contacted: 'Contacted',
  converted_to_client: 'Converted to Client',
  purchased: 'Purchased',
  commission_paid: 'Commission Paid',
  not_eligible: 'Not Eligible',
};

// ── Proposal status (Proposal.status) ─────────────────────────────────────────
export const PROPOSAL_STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-700',     icon: Clock },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700',     icon: Send },
  viewed:   { label: 'Viewed',   color: 'bg-purple-100 text-purple-700', icon: Eye },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700',   icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700',         icon: XCircle },
};