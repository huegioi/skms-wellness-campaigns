import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import EventDetailDialog from '@/components/calendar/EventDetailDialog';
import { parseISO } from 'date-fns';

// `sheets` is legacy (Google Sheet feed removed 2026-09-02); defaults to empty so the
// calendar renders from CalendarEvent records alone.
export default function MonthlyCalendar({ sheets = [], calendarEvents = [], refetchEvents }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [addingToGoogleCal, setAddingToGoogleCal] = useState(null);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState(null);

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
          sheet: sheet.name,
          sheetIndex,
          rawRow: row
        });
      });
    });
    return events;
  };

  const events = parseEvents();

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date) => {
    const dbEventsForDate = calendarEvents.filter(event => {
      const eventDate = parseISO(event.start_date);
      return eventDate.getFullYear() === date.getFullYear() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getDate() === date.getDate();
    }).map(event => ({
      ...event,
      isCalendarEvent: true,
      title: event.title,
      date: parseISO(event.start_date)
    }));

    // Build a set of DB event titles for this date to avoid showing sheet duplicates
    const dbTitles = new Set(dbEventsForDate.map(e => e.title?.toLowerCase().trim()));

    const sheetEventsForDate = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === date.getFullYear() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getDate() === date.getDate() &&
             !dbTitles.has(event.title?.toLowerCase().trim());
    });

    return [...dbEventsForDate, ...sheetEventsForDate];
  };

  const handleDateClick = (day) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayEvents = getEventsForDate(clickedDate);
    setSelectedDate(clickedDate);
    setSelectedEvents(dayEvents);
  };

  const addToGoogleCalendar = async (event) => {
    setAddingToGoogleCal(event.title);
    try {
      const startDate = new Date(event.date);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);

      const response = await base44.functions.invoke('googleCalendarSync', {
        action: 'createEvent',
        eventData: {
          title: event.title,
          description: (event.description && String(event.description).trim())
            ? event.description
            : `Client: ${event.client}\nSheet: ${event.sheet}`,
          location: event.location || '',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          all_day: false
        }
      });

      if (response.data.success) {
        alert('Event added to Google Calendar!');
      }
    } catch (error) {
      alert('Failed to add to Google Calendar: ' + error.message);
    } finally {
      setAddingToGoogleCal(null);
    }
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const isToday = (day) => {
    return day && 
           today.getFullYear() === currentDate.getFullYear() &&
           today.getMonth() === currentDate.getMonth() &&
           today.getDate() === day;
  };

  return (
    <div>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: '#013f7c' }}>{monthName}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-semibold text-sm text-gray-600 pb-2">
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            const dayEvents = day ? getEventsForDate(new Date(year, month, day)) : [];
            return (
              <div
                key={index}
                className={`min-h-[100px] border rounded-lg p-2 ${
                  day ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50'
                } ${isToday(day) ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => day && handleDateClick(day)}
              >
                {day && (
                  <>
                    <div className={`text-sm font-semibold mb-1 ${isToday(day) ? 'text-blue-600' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event, idx) => {
                        const bgColor = event.isCalendarEvent
                          ? event.invite_sent ? 'bg-orange-500' : event.google_event_id ? 'bg-purple-600' : 'bg-[#264d44]'
                          : 'bg-blue-400';
                        return (
                          <div
                            key={idx}
                            className={`text-xs px-1 py-0.5 rounded text-white truncate flex items-center gap-1 ${bgColor}`}
                            title={event.title}
                          >
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Color Key */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="font-semibold text-gray-700 mr-1">Key:</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#264d44] inline-block"></span>In app calendar</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-600 inline-block"></span>Synced to Google</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block"></span>Invite sent</span>
        </div>
      </Card>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Events for {selectedDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedEvents.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No events scheduled</p>
            ) : (
              selectedEvents.map((event, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4 border">
                  <div 
                    className="cursor-pointer hover:bg-gray-100 transition-colors rounded p-2 -m-2"
                    onClick={() => event.isCalendarEvent && setSelectedCalendarEvent(event)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {event.isCalendarEvent ? (
                        <>
                          <Badge className={`text-white ${event.invite_sent ? 'bg-orange-500' : event.google_event_id ? 'bg-purple-600' : 'bg-[#264d44]'}`}>
                            {event.invite_sent ? 'Invite Sent' : event.google_event_id ? 'Google Synced' : (eventTypeConfig[event.event_type]?.label || 'Event')}
                          </Badge>
                        </>
                      ) : (
                        <>
                          <Badge className="bg-blue-400 text-white">
                            {event.sheet}
                          </Badge>
                          {event.time && (
                            <span className="text-sm text-gray-600">{event.time}</span>
                          )}
                        </>
                      )}
                    </div>
                    <h4 className="font-semibold text-lg text-gray-800 mb-1">{event.title}</h4>
                    {(event.client_name || event.client) && (
                      <p className="text-sm text-gray-600">Client: {event.client_name || event.client}</p>
                    )}
                    {event.location && (
                      <p className="text-sm text-gray-600">Location: {event.location}</p>
                    )}
                    {event.isCalendarEvent && (
                      <p className="text-xs text-[#264d44] mt-2">Click to edit or delete</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Event Detail Dialog */}
      {selectedCalendarEvent && (
        <EventDetailDialog
          event={selectedCalendarEvent}
          open={!!selectedCalendarEvent}
          onOpenChange={(open) => !open && setSelectedCalendarEvent(null)}
          eventTypeConfig={eventTypeConfig}
          onUpdated={() => {
            refetchEvents();
            setSelectedDate(null);
            setSelectedCalendarEvent(null);
          }}
        />
      )}
    </div>
  );
}