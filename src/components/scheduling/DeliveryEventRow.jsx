import React, { useState } from 'react';
import { Calendar, Users, MapPin, Plus, CheckCircle2, MoreVertical, ArrowRightLeft, XCircle, Clock, UserCheck, Copy, QrCode } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';
import SourceBadge from './SourceBadge';
import PresenterStatusIcon, { getPresenterStatus } from './PresenterStatusIcon';
import FacilitationChecklist from '@/components/shared/FacilitationChecklist';
import { isChallengeEvent, getChallengeDayProgress } from '@/lib/challengeUtils';
import CheckinQrDialog from '@/components/shared/CheckinQrDialog';

/**
 * A row in the Delivery lens: sheet-parsed events + CalendarEvents with
 * service_id or proposal_id. Shows facilitation state for challenges,
 * presenter status icon, day-0/day-14 assessment marks, and booking actions.
 */
export default function DeliveryEventRow({ event, allServices, getEventAssessmentCounts, onSelectEvent, onAddToCalendar, addingToCalendar, onMoveLens }) {
  const isSheet = event.source === 'sheet';
  const isCalendar = event.source === 'calendar';
  const isPast = event.isPast;
  const [showQr, setShowQr] = useState(false);

  const { data: checkinCount = 0 } = useQuery({
    queryKey: ['event-checkins', event.id],
    queryFn: async () => {
      const checkins = await base44.entities.EventCheckin.filter({ event_id: event.id });
      return checkins.length;
    },
    enabled: isCalendar && !!event.id,
  });

  const serviceCategory = isCalendar ? allServices.find(s => s.id === event.service_id)?.category : null;
  const isChallenge = isChallengeEvent(event, serviceCategory);
  const progress = isChallenge ? getChallengeDayProgress(event) : null;

  const facilitationLabel = progress
    ? progress.isPastEnd
      ? `Day ${progress.totalDays} of ${progress.totalDays} ✓`
      : progress.isFacilitating
        ? `Day ${progress.currentDay} of ${progress.totalDays}`
        : `Day 1 of ${progress.totalDays}`
    : null;

  return (
    <div
      className={`rounded-lg p-4 border transition-shadow ${
        isPast
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : isCalendar
            ? 'bg-white cursor-pointer border-blue-100 hover:shadow-md'
            : 'bg-white border-gray-200'
      }`}
      onClick={() => isCalendar && !isPast && onSelectEvent(event)}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        {/* Date */}
        <div className="flex items-center gap-3 min-w-[140px]">
          <Calendar className={`w-5 h-5 ${isPast ? 'text-gray-400' : isCalendar ? 'text-blue-600' : 'text-gray-500'}`} />
          <div>
            <div className={`font-semibold text-sm ${isPast ? 'text-gray-400' : ''}`} style={isPast ? {} : { color: '#013f7c' }}>
              {isCalendar
                ? format(parseISO(event.start_date), 'MMM d')
                : event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            {isCalendar && !event.all_day && (
              <div className="text-xs text-gray-500">{format(parseISO(event.start_date), 'h:mm a')}</div>
            )}
            {isSheet && event.time && (
              <div className="text-xs text-gray-500">{event.time}</div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className={`font-semibold ${isPast ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{event.title}</div>
            <SourceBadge source={event.sourceBadge} />
            {isCalendar && (() => {
              const status = getPresenterStatus(event);
              if (status === 'accepted') return <PresenterStatusIcon event={event} />;
              if (status === 'declined') return (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Needs presenter
                </span>
              );
              if (status === 'assigned') {
                const daysOut = Math.ceil((parseISO(event.start_date) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysOut <= 14) return (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Awaiting presenter
                  </span>
                );
                return <PresenterStatusIcon event={event} />;
              }
              return <PresenterStatusIcon event={event} />;
            })()}
            {facilitationLabel && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {facilitationLabel}
              </span>
            )}
            {isPast && <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-500">Past</span>}
            {checkinCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                {checkinCount} checked in
              </span>
            )}
            {isCalendar && !isPast && event.google_event_id && !event.ingested && (
              <CheckCircle2 className="w-4 h-4 text-green-600" title="Synced to Google Calendar" />
            )}
          </div>
          {event.client_name && (
            <div className={`text-sm flex items-center gap-1 mb-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <Users className="w-3 h-3" />
              {event.client_name}
            </div>
          )}
          {event.presenter && (
            <div className={`text-sm mb-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <span className="font-medium">Presenter:</span> {event.presenter}
            </div>
          )}
          {event.location && (
            <div className={`text-sm flex items-start gap-1 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="break-all">{event.location}</span>
            </div>
          )}
          {isCalendar && isChallenge && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <FacilitationChecklist
                day0Count={getEventAssessmentCounts(event).day0}
                day14Count={getEventAssessmentCounts(event).day14}
                hasRecording={!!event.recording_link}
                compact
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 self-start shrink-0">
          {!isPast && isSheet && (
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); onAddToCalendar(event); }}
              disabled={addingToCalendar === event.title}
              className="bg-[#264d44] hover:bg-[#1a3830] whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1" />
              {addingToCalendar === event.title ? 'Adding...' : 'Add to Calendar'}
            </Button>
          )}
          {isCalendar && (
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
                <DropdownMenuItem onClick={() => onMoveLens(event, 'meetings')}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Move to Meetings
                </DropdownMenuItem>
                {event.checkin_token && (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/Checkin?t=${event.checkin_token}`); }}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy check-in link
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowQr(true); }}>
                      <QrCode className="w-4 h-4 mr-2" />
                      Show QR code
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {isCalendar && event.checkin_token && (
        <CheckinQrDialog
          open={showQr}
          onOpenChange={setShowQr}
          checkinUrl={`${window.location.origin}/Checkin?t=${event.checkin_token}`}
          eventTitle={event.title}
          eventDate={event.start_date}
        />
      )}
    </div>
  );
}