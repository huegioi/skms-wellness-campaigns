import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns';

export default function CalendarSidebar({ upcomingEvents, eventTypeConfig, onEventClick }) {
  const getTimeLabel = (date) => {
    const eventDate = parseISO(date);
    if (isToday(eventDate)) return 'Today';
    if (isTomorrow(eventDate)) return 'Tomorrow';
    const days = differenceInDays(eventDate, new Date());
    if (days < 7) return `In ${days} days`;
    return format(eventDate, 'MMM d');
  };

  return (
    <div className="w-full lg:w-80 space-y-6">
      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-lg p-5">
        <h3 className="font-bold text-lg mb-4" style={{ color: '#264d44' }}>
          <Clock className="w-5 h-5 inline mr-2" />
          Upcoming Events
        </h3>
        
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-500 text-sm">No upcoming events</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map(event => {
              const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
              const Icon = config.icon;
              return (
                <div 
                  key={event.id} 
                  className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => onEventClick(event)}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: event.color || config.color }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      <p className="text-xs text-gray-500">
                        {getTimeLabel(event.start_date)} • {format(parseISO(event.start_date), 'h:mm a')}
                      </p>
                      {event.client_name && (
                        <p className="text-xs text-gray-400 mt-1">{event.client_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="bg-white rounded-xl shadow-lg p-5">
        <h3 className="font-bold text-lg mb-4" style={{ color: '#264d44' }}>
          <AlertCircle className="w-5 h-5 inline mr-2" />
          Quick Tips
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• Click any day to add a new event</p>
          <p>• Click an event to view details or export to your calendar</p>
          <p>• Use event types to organize workshops, challenges, and deliveries</p>
          <p>• Link events to clients and proposals for easy tracking</p>
        </div>
      </div>

      {/* Calendar Sync Info */}
      <div className="bg-gradient-to-br from-[#013f7c] to-[#264d44] rounded-xl shadow-lg p-5 text-white">
        <h3 className="font-bold text-lg mb-3">
          <ExternalLink className="w-5 h-5 inline mr-2" />
          Sync Your Calendar
        </h3>
        <p className="text-sm opacity-90 mb-3">
          Export events to Google Calendar, Outlook, or download .ics files for any calendar app.
        </p>
        <p className="text-xs opacity-70">
          Click on any event to see export options.
        </p>
      </div>
    </div>
  );
}