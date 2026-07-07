import React from 'react';
import { Mail, Phone, MessageSquare, Users, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { OwnerChip } from '@/components/shared/inline/OwnerChip';
import { FollowUpDatePill } from '@/components/shared/inline/FollowUpDatePill';

const CHANNEL_META = {
  email:    { icon: Mail,           label: 'emailed' },
  call:     { icon: Phone,           label: 'called' },
  phone:    { icon: Phone,           label: 'called' },
  text:     { icon: MessageSquare,   label: 'texted' },
  linkedin: { icon: MessageSquare,   label: 'LinkedIn' },
  meeting:  { icon: Users,           label: 'met' },
  referral: { icon: Users,           label: 'referred' },
  event:    { icon: Calendar,        label: 'event' },
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

/** Stale threshold (days) based on lead acquisition status. */
export function getLeadStaleThreshold(status) {
  const map = {
    cold: 3, contacted: 3, responded: 5, in_conversation: 5,
    meeting_scheduled: 7, proposal_sent: 7,
  };
  return map[status] || null;
}

/**
 * Shared activity strip: last touch (channel icon + relative time, red when stale)
 * and next (upcoming event / follow-up date / ⚠ nothing scheduled).
 *
 * compact=true → single inline line for list rows.
 * compact=false → two lines (owner + last touch, then next) for board cards.
 */
export function ActivityStrip({
  touchDate, touchChannel = 'other', staleThreshold = null,
  nextEvent, followUpDate, onFollowUpDateChange, recordId,
  owner, onOwnerChange,
  compact = false,
}) {
  const channelMeta = CHANNEL_META[touchChannel] || CHANNEL_META.other;
  const ChannelIcon = channelMeta.icon;
  const ago = timeAgo(touchDate);

  const touchDays = touchDate ? differenceInDays(new Date(), new Date(touchDate)) : null;
  const isStale = staleThreshold && touchDays !== null && touchDays > staleThreshold;

  const touchLine = ago ? (
    <span className={`text-xs flex items-center gap-0.5 ${isStale ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
      <ChannelIcon className="w-3 h-3" />
      {channelMeta.label} · {ago}
    </span>
  ) : (
    <span className="text-xs text-gray-400 italic">No contact yet</span>
  );

  let nextLine = null;
  if (nextEvent) {
    let eventLabel = 'Event';
    try {
      const parsed = parseISO(nextEvent.start_date);
      if (isValid(parsed)) eventLabel = format(parsed, 'EEE h:mm a');
    } catch { /* keep default */ }
    nextLine = (
      <span className="text-xs text-blue-600 flex items-center gap-0.5 font-medium">
        <Calendar className="w-3 h-3" />
        {eventLabel}
      </span>
    );
  } else if (followUpDate) {
    nextLine = onFollowUpDateChange ? (
      <FollowUpDatePill value={followUpDate} onSave={(v) => onFollowUpDateChange(recordId, v)} />
    ) : (
      <span className="text-xs text-amber-600 flex items-center gap-0.5 font-medium">
        <Calendar className="w-3 h-3" />
        {(() => { try { return format(parseISO(followUpDate), 'MMM d'); } catch { return followUpDate; } })()}
      </span>
    );
  } else {
    nextLine = (
      <span className="text-xs text-amber-600 flex items-center gap-0.5 font-medium">
        <AlertTriangle className="w-3 h-3" />
        nothing scheduled
      </span>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {touchLine}
        <span className="text-gray-300">·</span>
        {nextLine}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {owner !== undefined && onOwnerChange && (
          <OwnerChip value={owner} onSave={(v) => onOwnerChange(recordId, v)} />
        )}
        {touchLine}
      </div>
      <div className="flex items-center gap-1">
        {nextLine}
      </div>
    </>
  );
}

export default ActivityStrip;