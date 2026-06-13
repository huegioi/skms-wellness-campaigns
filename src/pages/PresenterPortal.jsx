import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isFuture } from 'date-fns';
import { Calendar, Clock, Building, ChevronRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import PresenterSessionDetail from '@/components/presenter/PresenterSessionDetail';

export default function PresenterPortal() {
  const portalId = new URLSearchParams(window.location.search).get('id');
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
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No portal ID provided.</p>
          <p className="text-sm text-gray-400 mt-1">Please use the link provided to you by SKMS Wellness.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#013f7c]" />
      </div>
    );
  }

  if (isError || !data?.presenter) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Portal not found.</p>
          <p className="text-sm text-gray-400 mt-1">This link may be invalid or expired. Please contact SKMS Wellness.</p>
        </div>
      </div>
    );
  }

  const { presenter, upcoming, past } = data;

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
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <img
            src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
            alt="SKMS Wellness"
            className="h-9"
          />
          <div>
            <h1 className="text-xl font-bold">Presenter Portal</h1>
            <p className="text-blue-200 text-sm">Welcome, {presenter.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Upcoming */}
        <section>
          <h2 className="text-lg font-bold text-[#013f7c] mb-4 flex items-center gap-2">
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
                <SessionCard key={event.id} event={event} upcoming onClick={() => setSelectedEvent(event)} />
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
                <SessionCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SessionCard({ event, upcoming, onClick }) {
  const start = parseISO(event.start_date);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 ${
        upcoming ? 'border-l-[#013f7c]' : 'border-l-gray-200'
      }`}
    >
      <div className={`flex-shrink-0 rounded-xl text-center px-3 py-2 min-w-[56px] ${upcoming ? 'bg-[#013f7c]' : 'bg-gray-100'}`}>
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
          {event.completed && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="w-3 h-3" /> Completed
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
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </button>
  );
}