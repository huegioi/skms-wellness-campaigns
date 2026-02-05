import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import EventDetailDialog from '@/components/calendar/EventDetailDialog';
import { parseISO, format, addDays, startOfWeek, endOfWeek } from 'date-fns';

export default function WeeklyCalendar({ sheets }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedEvent, setSelectedEvent] = useState(null);

  const { data: calendarEvents = [], refetch: refetchEvents } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list()
  });

  const eventTypeConfig = {
    meeting: { label: 'Meeting', color: '#3B82F6', icon: CalendarIcon },
    workshop: { label: 'Workshop', color: '#8B5CF6', icon: CalendarIcon },
    challenge: { label: 'Challenge', color: '#10B981', icon: CalendarIcon },
    leadership: { label: 'Leadership', color: '#F59E0B', icon: CalendarIcon },
    class: { label: 'Class', color: '#EC4899', icon: CalendarIcon },
    delivery: { label: 'Delivery', color: '#06B6D4', icon: CalendarIcon },
    follow_up: { label: 'Follow Up', color: '#14B8A6', icon: CalendarIcon },
    other: { label: 'Other', color: '#264d44', icon: CalendarIcon }
  };

  const sheetColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500'
  ];

  const parseEvents = () => {
    const events = [];
    sheets.forEach((sheet, sheetIndex) => {
      sheet.data.forEach(row => {
        let dateValue = null;
        for (const [key, value] of Object.entries(row)) {
          const keyLower = key.toLowerCase();
          if ((keyLower.includes('date') || keyLower.includes('day') || keyLower === 'when') && value && value.trim() !== '') {
            dateValue = value;
            break;
          }
        }
        
        if (!dateValue || dateValue.trim() === '') return;

        let eventDate;
        try {
          eventDate = new Date(dateValue);
          const parts = dateValue.split('/');
          if (parts.length === 3) {
            eventDate = new Date(parts[2], parts[0] - 1, parts[1]);
          }
          if (isNaN(eventDate.getTime())) return;
        } catch {
          return;
        }

        let title = 'Event';
        for (const [key, value] of Object.entries(row)) {
          if ((key.toLowerCase().includes('event') || 
               key.toLowerCase().includes('service') || 
               key.toLowerCase().includes('title') ||
               key.toLowerCase().includes('name')) && value) {
            title = value;
            break;
          }
        }

        events.push({
          date: eventDate,
          title,
          client: row['Client'] || row['Payee'] || row['Company'] || row['CLIENT'] || '',
          location: row['Location'] || row['LOCATION'] || row['Venue'] || '',
          time: row['Time'] || row['TIME'] || '',
          presenter: row['Presenter'] || row['PRESENTER'] || row['presenter'] || '',
          sheet: sheet.name,
          sheetIndex,
          rawRow: row
        });
      });
    });
    return events;
  };

  const sheetEvents = parseEvents();

  const getEventsForDate = (date) => {
    const sheetEventsForDate = sheetEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });

    const dbEvents = calendarEvents.filter(event => {
      const eventDate = parseISO(event.start_date);
      return eventDate.toDateString() === date.toDateString();
    }).map(event => ({
      ...event,
      isCalendarEvent: true,
      title: event.title,
      date: parseISO(event.start_date),
      time: !event.all_day ? format(parseISO(event.start_date), 'h:mm a') : 'All day'
    }));

    return [...sheetEventsForDate, ...dbEvents].sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const previousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const nextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const weekEndDate = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
  const weekRange = `${format(currentWeekStart, 'MMM d')} - ${format(weekEndDate, 'MMM d, yyyy')}`;

  return (
    <div>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#013f7c' }}>{weekRange}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={previousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
              This Week
            </Button>
            <Button variant="outline" size="sm" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDate(day);
            return (
              <div key={index} className="border rounded-lg overflow-hidden">
                <div className={`p-2 text-center font-semibold ${isToday(day) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  <div className="text-xs">{format(day, 'EEE')}</div>
                  <div className="text-lg">{format(day, 'd')}</div>
                </div>
                <div className="p-2 space-y-2 min-h-[200px] bg-white">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center mt-4">No events</p>
                  ) : (
                    dayEvents.map((event, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded cursor-pointer hover:opacity-90 transition-opacity ${
                          event.isCalendarEvent 
                            ? 'bg-[#264d44] text-white' 
                            : sheetColors[event.sheetIndex % sheetColors.length] + ' text-white'
                        }`}
                        onClick={() => event.isCalendarEvent && setSelectedEvent(event)}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {event.time && <span className="text-xs font-semibold">{event.time}</span>}
                          {event.isCalendarEvent && event.google_event_id && (
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs font-medium line-clamp-2">{event.title}</div>
                        {(event.client_name || event.client) && (
                          <div className="text-xs opacity-90 mt-1 truncate">{event.client_name || event.client}</div>
                        )}
                        {event.presenter && (
                          <div className="text-xs opacity-90 truncate">By: {event.presenter}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sheets.map((sheet, index) => (
            <Badge key={index} className={`${sheetColors[index % sheetColors.length]} text-white`}>
              {sheet.name}
            </Badge>
          ))}
        </div>
      </Card>

      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          eventTypeConfig={eventTypeConfig}
          onUpdated={() => {
            refetchEvents();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}