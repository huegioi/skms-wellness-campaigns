import React from 'react';
import { Calendar as CalIcon, Users, ExternalLink, MoreVertical, ArrowRightLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';
import SourceBadge from './SourceBadge';
import { getSourceCalendarLabel } from './eventLenses';

/**
 * A row in the Meetings lens: ingested CalendarEvents or CalendarEvents
 * with no service/proposal linkage (discovery calls, check-ins, renewal reviews).
 * Shows the linked contact (clickable to their detail view) and which
 * calendar the event came from.
 */
export default function MeetingsEventRow({ event, onSelectEvent, onMoveLens }) {
  const isPast = event.isPast;
  const calendarLabel = getSourceCalendarLabel(event.source_calendar);

  // Resolve contact link from the strongest identifier available
  let contactLink = null;
  const contactName = event.client_name || '';
  if (event.client_id) {
    contactLink = `/Clients?clientId=${event.client_id}`;
  } else if (event.lead_id) {
    contactLink = `/Leads?leadId=${event.lead_id}`;
  } else if (event.referral_partner_id) {
    contactLink = `/Leads?partnerId=${event.referral_partner_id}`;
  }

  return (
    <div
      className={`rounded-lg p-4 border transition-shadow cursor-pointer ${
        isPast
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : 'bg-white border-blue-100 hover:shadow-md'
      }`}
      onClick={() => !isPast && onSelectEvent(event)}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* Date */}
        <div className="flex items-center gap-3 min-w-[140px]">
          <CalIcon className={`w-5 h-5 ${isPast ? 'text-gray-400' : 'text-blue-600'}`} />
          <div>
            <div className={`font-semibold text-sm ${isPast ? 'text-gray-400' : ''}`} style={isPast ? {} : { color: '#013f7c' }}>
              {format(parseISO(event.start_date), 'MMM d')}
            </div>
            {!event.all_day && (
              <div className="text-xs text-gray-500">{format(parseISO(event.start_date), 'h:mm a')}</div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className={`font-semibold ${isPast ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{event.title}</div>
            <SourceBadge source={event.sourceBadge} />
            {isPast && <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-500">Past</span>}
          </div>
          {contactName && (
            <div className={`text-sm flex items-center gap-1 mb-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <Users className="w-3 h-3" />
              {contactLink ? (
                <Link
                  to={contactLink}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-[#013f7c] hover:underline flex items-center gap-0.5"
                >
                  {contactName}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : contactName}
            </div>
          )}
          {calendarLabel && (
            <div className={`text-xs flex items-center gap-1 ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>
              <CalIcon className="w-3 h-3" />
              {calendarLabel}'s calendar
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="self-start shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                onClick={(e) => e.stopPropagation()}
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onMoveLens(event, 'delivery')}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Move to Delivery
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}