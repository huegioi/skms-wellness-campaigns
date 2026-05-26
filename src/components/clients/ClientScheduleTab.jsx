import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, CheckCircle2 } from 'lucide-react';

const eventTypeColors = {
  meeting: 'bg-blue-100 text-blue-700',
  workshop: 'bg-emerald-100 text-emerald-700',
  challenge: 'bg-orange-100 text-orange-700',
  leadership: 'bg-purple-100 text-purple-700',
  class: 'bg-teal-100 text-teal-700',
  delivery: 'bg-yellow-100 text-yellow-700',
  follow_up: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function ClientScheduleTab({ client }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['clientEvents', client.id],
    queryFn: async () => {
      const all = await base44.entities.CalendarEvent.list('-start_date', 200);
      return all.filter(e =>
        e.client_id === client.id ||
        (e.client_name && (
          e.client_name === client.name ||
          e.client_name === client.company
        ))
      );
    }
  });

  if (isLoading) {
    return <p className="text-center text-gray-500 py-8">Loading events...</p>;
  }

  const upcoming = events.filter(e => new Date(e.start_date) >= new Date() && !e.completed);
  const past = events.filter(e => new Date(e.start_date) < new Date() || e.completed);

  const renderEvent = (event) => {
    const start = new Date(event.start_date);
    const end = event.end_date ? new Date(event.end_date) : null;
    const colorClass = eventTypeColors[event.event_type] || eventTypeColors.other;

    return (
      <div key={event.id} className={`border rounded-lg p-4 ${event.completed ? 'bg-gray-50 opacity-75' : 'bg-white'}`}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-sm">{event.title}</p>
              <Badge className={`text-xs ${colorClass}`}>{event.event_type?.replace('_', ' ')}</Badge>
              {event.completed && (
                <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Done
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {!event.all_day && (
                <span className="flex items-center gap-1 ml-1">
                  <Clock className="w-3.5 h-3.5" />
                  {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {end && ` – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                </span>
              )}
            </p>
            {event.presenter && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3" /> {event.presenter}
              </p>
            )}
            {event.location && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {event.location}
              </p>
            )}
            {event.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.description}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      <div>
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          Upcoming Events ({upcoming.length})
        </h4>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No upcoming events scheduled.</p>
        ) : (
          <div className="space-y-3">{upcoming.map(renderEvent)}</div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            Past Events ({past.length})
          </h4>
          <div className="space-y-3">{past.map(renderEvent)}</div>
        </div>
      )}

      {events.length === 0 && (
        <p className="text-center text-gray-500 py-8">No events found for this client.</p>
      )}
    </div>
  );
}