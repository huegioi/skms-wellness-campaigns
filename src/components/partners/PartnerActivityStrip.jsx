import React from 'react';
import { Mail, Phone, MessageSquare, Users, Clock, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { OwnerChip } from '@/components/shared/inline/OwnerChip';
import { FollowUpDatePill } from '@/components/shared/inline/FollowUpDatePill';

const CHANNEL_META = {
  email:    { icon: Mail,           label: 'emailed' },
  call:     { icon: Phone,           label: 'called' },
  text:     { icon: MessageSquare,   label: 'texted' },
  linkedin: { icon: MessageSquare,   label: 'LinkedIn' },
  meeting:  { icon: Users,           label: 'met' },
  other:    { icon: Clock,           label: 'touched' },
};

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const days = differenceInDays(new Date(), date);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Two-line activity strip for partner pipeline cards.
 *
 * Line 1 — last touch: channel icon + "emailed · 3d ago" (red when stale).
 * Line 2 — next: follow-up pill, else "⚠️ nothing scheduled".
 *
 * Props:
 *  - partner: the ReferralPartner entity
 *  - latestInteraction: most recent ClientInteraction for this partner (or null)
 *  - staleThreshold: max days before the last touch is shown in red (null = no stale check)
 *  - onOwnerChange, onFollowUpDateChange: callbacks
 */
export function PartnerActivityStrip({ partner, latestInteraction, staleThreshold, onOwnerChange, onFollowUpDateChange }) {
  const touchDate = latestInteraction?.date || partner.last_touchpoint_date || partner.last_contacted_date;
  const touchChannel = latestInteraction?.channel || 'other';
  const channelMeta = CHANNEL_META[touchChannel] || CHANNEL_META.other;
  const ChannelIcon = channelMeta.icon;
  const ago = timeAgo(touchDate);

  const touchDays = touchDate ? differenceInDays(new Date(), new Date(touchDate)) : null;
  const isStale = staleThreshold && touchDays !== null && touchDays > staleThreshold;

  let nextLine = null;
  if (partner.follow_up_due_date) {
    nextLine = (
      <FollowUpDatePill value={partner.follow_up_due_date} onSave={(v) => onFollowUpDateChange(partner.id, v)} />
    );
  } else {
    nextLine = (
      <span className="text-xs text-amber-600 flex items-center gap-0.5 font-medium">
        <AlertTriangle className="w-3 h-3" />
        nothing scheduled
      </span>
    );
  }

  return (
    <>
      {/* Line 1: Owner + last touch */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <OwnerChip value={partner.owner} onSave={(v) => onOwnerChange(partner.id, v)} />
        {ago ? (
          <span className={`text-xs flex items-center gap-0.5 ${isStale ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            <ChannelIcon className="w-3 h-3" />
            {channelMeta.label} · {ago}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">No contact yet</span>
        )}
      </div>

      {/* Line 2: Next */}
      <div className="flex items-center gap-1">
        {nextLine}
      </div>
    </>
  );
}

export default PartnerActivityStrip;