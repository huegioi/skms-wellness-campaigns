import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, Building, ChevronRight, CheckCircle2, Loader2, AlertCircle, DollarSign } from 'lucide-react';
import PresenterSessionDetail from '@/components/presenter/PresenterSessionDetail';
import EarningsDetail from '@/components/presenter/EarningsDetail';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';
import { Button } from '@/components/ui/button';
import { PortalShell, PortalLoading, PortalError } from '@/components/portal/PortalShell';

export default function PresenterPortal() {
  const [searchParams] = useSearchParams();
  const portalId = searchParams.get('id');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['presenter-portal', portalId],
    queryFn: () => base44.functions.invoke('getPresenterPortalData', { portal_id: portalId }).then(r => r.data),
    enabled: !!portalId,
    retry: false,
  });

  const handleUpdated = () => {
    queryClient.invalidateQueries(['presenter-portal', portalId]);
    // Refresh selected event from updated data
    setSelectedEvent(null);
  };

  if (!portalId) {
    return (
      <PortalError
        icon={AlertCircle}
        iconClass="w-10 h-10 text-amber-400"
        heading="No portal ID provided."
        message="Please use the link provided to you by SKMS Wellness."
      />
    );
  }

  if (isLoading) {
    return <PortalLoading accentColor="#013f7c" />;
  }

  if (isError || !data?.presenter) {
    return (
      <PortalError
        icon={AlertCircle}
        iconClass="w-10 h-10 text-red-400"
        heading="Portal not found."
        message="This link may be invalid or expired. Please contact SKMS Wellness."
      />
    );
  }

  const { presenter, upcoming, past, earnings } = data;

  // If an event is selected, show detail — re-find it in freshest data
  if (selectedEvent) {
    const allEvents = [...(upcoming || []), ...(past || [])];
    const freshEvent = allEvents.find(e => e.id === selectedEvent.id) || selectedEvent;
    return (
      <PresenterSessionDetail
        event={freshEvent}
        portalId={portalId}
        onBack={() => setSelectedEvent(null)}
        onUpdated={handleUpdated}
      />
    );
  }

  return (
    <PortalShell
      accentColor="#013f7c"
      title="Presenter Portal"
      subtitle={`Welcome, ${presenter.name}`}
      maxWidth="max-w-3xl"
      headerPadding="px-6 py-5"
      logoClass="h-9"
      titleClass="text-xl font-bold"
      subtitleClass="text-blue-200 text-sm"
      contentClass="px-4 py-8 space-y-8"
    >

        {/* Earnings Summary */}
        {earnings?.has_rate && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              My Earnings
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Pending Payment</p>
                <p className="text-2xl font-bold text-amber-700">
                  ${earnings.total_pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-amber-500 mt-1">Completed sessions awaiting payout</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Total Paid</p>
                <p className="text-2xl font-bold text-green-700">
                  ${earnings.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-500 mt-1">Sessions paid to date</p>
              </div>
            </div>

            <EarningsDetail past={past} earnings={earnings} />
          </div>
        )}

        {/* Upcoming */}
        <section>
          <h2 className="text-lg font-bold text-brand-navy mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Sessions
          </h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No upcoming sessions scheduled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(event => (
                <SessionCard key={event.id} event={event} upcoming portalId={portalId} onCompleted={handleUpdated} onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          )}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-400 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Past Sessions
            </h2>
            <div className="space-y-3">
              {past.map(event => (
                <SessionCard key={event.id} event={event} portalId={portalId} onCompleted={handleUpdated} onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          </section>
        )}
      </PortalShell>
    );
  }

function SessionCard({ event, upcoming, portalId, onCompleted, onClick }) {
  const [completing, setCompleting] = useState(false);
  const start = parseISO(event.start_date);
  const sessionPassed = new Date(event.start_date) <= new Date();

  const handleComplete = async (e) => {
    e.stopPropagation();
    setCompleting(true);
    await base44.functions.invoke('updatePresenterSession', {
      portal_id: portalId, event_id: event.id, completed: true
    });
    setCompleting(false);
    onCompleted();
  };

  return (
    <div
      className={`w-full bg-white rounded-2xl shadow-sm border-l-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        upcoming ? 'border-l-brand-navy' : 'border-l-gray-200'
      }`}
    >
      {/* Main row — clickable to open detail */}
      <button onClick={onClick} className="w-full text-left p-5 flex items-center gap-4">
        <div className={`flex-shrink-0 rounded-xl text-center px-3 py-2 min-w-[56px] ${upcoming ? 'bg-brand-navy' : 'bg-gray-100'}`}>
          <p className={`text-xs font-bold uppercase ${upcoming ? 'text-blue-200' : 'text-gray-400'}`}>{format(start, 'MMM')}</p>
          <p className={`text-2xl font-bold leading-none ${upcoming ? 'text-white' : 'text-gray-500'}`}>{format(start, 'd')}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800 truncate">{event.title}</p>
            {event.presenter_accepted && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3" /> Accepted
              </span>
            )}
            {event.completed && !event.presenter_paid && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3" /> Completed · Pending payout
              </span>
            )}
            {event.completed && event.presenter_paid && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3" /> Paid
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            {event.client_name && (
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5" />
                {event.client_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {format(start, 'h:mm a')}
            </span>
            {event.service_name && (
              <span className="flex items-center gap-1.5">
                {event.service_name}
                {event.service_included_assessments?.length > 0 && (
                  <AssessmentBadges assessments={event.service_included_assessments} size="xs" />
                )}
              </span>
            )}
            {event.session_fee != null && (
              <span className="flex items-center gap-1 font-medium text-gray-600">
                <DollarSign className="w-3.5 h-3.5" />
                ${Number(event.session_fee).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
      </button>

      {/* Mark Complete footer — shown when not yet completed */}
      {!event.completed && (
        <div className="px-5 pb-4 flex items-center gap-3">
          <div title={!sessionPassed ? 'Available after the session' : undefined} className="inline-block">
            <Button
              size="sm"
              variant="outline"
              disabled={completing || !sessionPassed}
              onClick={handleComplete}
              className={`text-xs gap-1.5 ${!sessionPassed ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Mark Complete
            </Button>
          </div>
          {!sessionPassed && <p className="text-xs text-gray-400">Available after the session</p>}
        </div>
      )}
    </div>
  );
}