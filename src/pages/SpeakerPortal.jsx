import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, isPast, isFuture, parseISO } from 'date-fns';
import { Calendar, Clock, Video, ChevronRight, CheckCircle2, Loader2, QrCode, Copy, Check, User, Building, FileText } from 'lucide-react';
import SpeakerSessionDetail from '@/components/speaker/SpeakerSessionDetail';

export default function SpeakerPortal() {
  const [user, setUser] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['speaker-events', user?.email],
    queryFn: () => base44.entities.CalendarEvent.filter({ presenter_email: user.email }),
    enabled: !!user?.email,
  });

  const upcoming = events
    .filter(e => !e.completed && isFuture(parseISO(e.start_date)))
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const past = events
    .filter(e => e.completed || isPast(parseISO(e.start_date)))
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#013f7c]" />
      </div>
    );
  }

  if (selectedEvent) {
    return (
      <SpeakerSessionDetail
        event={selectedEvent}
        onBack={() => setSelectedEvent(null)}
        user={user}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
              alt="SKMS Wellness"
              className="h-9"
            />
            <div>
              <h1 className="text-xl font-bold">Speaker Portal</h1>
              <p className="text-blue-200 text-sm">Welcome, {user.full_name}</p>
            </div>
          </div>
          <button
            onClick={() => base44.auth.logout()}
            className="text-blue-200 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Upcoming Sessions */}
        <section>
          <h2 className="text-lg font-bold text-[#013f7c] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Sessions
          </h2>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#013f7c]" />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No upcoming sessions scheduled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(event => (
                <SessionCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} upcoming />
              ))}
            </div>
          )}
        </section>

        {/* Past Sessions */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-500 mb-4 flex items-center gap-2">
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

function SessionCard({ event, onClick, upcoming }) {
  const start = parseISO(event.start_date);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 ${
        upcoming ? 'border-l-[#013f7c]' : 'border-l-gray-200'
      }`}
    >
      {/* Date Block */}
      <div className={`flex-shrink-0 rounded-xl text-center px-3 py-2 min-w-[56px] ${upcoming ? 'bg-[#013f7c]' : 'bg-gray-100'}`}>
        <p className={`text-xs font-bold uppercase ${upcoming ? 'text-blue-200' : 'text-gray-400'}`}>{format(start, 'MMM')}</p>
        <p className={`text-2xl font-bold leading-none ${upcoming ? 'text-white' : 'text-gray-500'}`}>{format(start, 'd')}</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 truncate">{event.title}</p>
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
          {event.location && (
            <span className="flex items-center gap-1 text-blue-500">
              <Video className="w-3.5 h-3.5" />
              Video link
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </button>
  );
}