import React from 'react';
import { Mail, Phone, MessageSquare, Users, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
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
 * Two-line activity strip for lead pipeline cards.
 *
 * Line 1 — last touch: channel icon + "emailed · 3d ago" (red when stale).
 * Line 2 — next: upcoming linked CalendarEvent, else follow-up pill, else "⚠️ nothing scheduled".
 *
 * Props:
 *  - lead: the Lead entity
 *  - latestInteraction: most recent ClientInteraction for this lead (or null)
 *  - nextEvent: upcoming CalendarEvent linked to this lead (or null)
 *  - staleThreshold: max days before the last touch is shown in red (null = no stale check)
 *  - onOwnerChange, onFollowUpDateChange: callbacks
 */
export function LeadActivityStrip({ lead, latestInteraction, nextEvent, staleThreshold, onOwnerChange, onFollowUpDateChange }) {
  const touchDate = latestInteraction?.date || lead.last_contacted_date;
  const touchChannel = latestInteraction?.channel || lead.outreach_channel || 'other';
  const channelMeta = CHANNEL_META[touchChannel] || CHANNEL_META.other;
  const ChannelIcon = channelMeta.icon;
  const ago = timeAgo(touchDate);

  const touchDays = touchDate ? differenceInDays(new Date(), new Date(touchDate)) : null;
  const isStale = staleThreshold && touchDays !== null && touchDays > staleThreshold;

  let nextLine = null;
  if (nextEvent) {
    let eventLabel = 'Event';
    try {
      const parsed = parseISO(nextEvent.start_date);
      if (isValid(parsed)) {
        eventLabel = format(parsed, 'EEE h:mm a');
      }
    } catch { /* keep default */ }
    nextLine = (
      <span className="text-xs text-blue-600 flex items-center gap-0.5 font-medium">
        <Calendar className="w-3 h-3" />
        {eventLabel}
      </span>
    );
  } else if (lead.follow_up_due_date) {
    nextLine = (
      <FollowUpDatePill value={lead.follow_up_due_date} onSave={(v) => onFollowUpDateChange(lead.id, v)} />
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
        <OwnerChip value={lead.owner} onSave={(v) => onOwnerChange(lead.id, v)} />
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

export default LeadActivityStrip;