import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, 
  Users, FileText, Dumbbell, Award, Package, Clock, Video, Settings, RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import EventDialog from '@/components/calendar/EventDialog';
import EventDetailDialog from '@/components/calendar/EventDetailDialog';
import CalendarSidebar from '@/components/calendar/CalendarSidebar';
import CalendarSyncSettings from '@/components/calendar/CalendarSyncSettings';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('month');
  const [showSyncSettings, setShowSyncSettings] = useState(false);

  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date')
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list()
  });

  const eventTypeConfig = {
    meeting: { label: 'Client Meeting', color: '#013f7c', icon: Users },
    workshop: { label: 'Workshop', color: '#264d44', icon: Award },
    challenge: { label: '14-Day Challenge', color: '#ff9878', icon: Dumbbell },
    leadership: { label: 'Leadership Workshop', color: '#770142', icon: Award },
    class: { label: 'Weekly Class', color: '#cae5e3', icon: Dumbbell },
    delivery: { label: 'Wellness Box Delivery', color: '#eaf995', icon: Package },
    follow_up: { label: 'Proposal Follow-up', color: '#441d37', icon: FileText },
    other: { label: 'Other', color: '#666', icon: Clock }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad days to start from Sunday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(daysInMonth);

  const getEventsForDay = (date) => {
    if (!date) return [];
    return events.filter(event => {
      const eventDate = parseISO(event.start_date);
      return isSameDay(eventDate, date);
    });
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setShowEventDialog(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    setSelectedEvent(event);
  };

  // Get upcoming events for sidebar
  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Calendar */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Header */}
              <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#013f7c' }}>Calendar</h1>
                  <p className="text-gray-500">Schedule and manage your events</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-semibold min-w-[140px] text-center">
                      {format(currentDate, 'MMMM yyyy')}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setShowSyncSettings(true)} title="Sync Settings">
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => { setSelectedDate(new Date()); setShowEventDialog(true); }} className="bg-[#770142] hover:bg-[#5a0132]">
                    <Plus className="w-4 h-4 mr-2" /> Add Event
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="p-2 md:p-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs md:text-sm font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {paddedDays.map((date, index) => {
                    const dayEvents = date ? getEventsForDay(date) : [];
                    const isCurrentMonth = date && isSameMonth(date, currentDate);
                    const isCurrentDay = date && isToday(date);

                    return (
                      <div
                        key={index}
                        onClick={() => date && handleDayClick(date)}
                        className={`min-h-[80px] md:min-h-[100px] p-1 md:p-2 rounded-lg cursor-pointer transition-all ${
                          !date ? 'bg-transparent' : 
                          isCurrentDay ? 'bg-[#770142]/10 border-2 border-[#770142]' :
                          isCurrentMonth ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50/50'
                        }`}
                      >
                        {date && (
                          <>
                            <span className={`text-xs md:text-sm font-medium ${
                              isCurrentDay ? 'text-[#770142] font-bold' :
                              isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                            }`}>
                              {format(date, 'd')}
                            </span>
                            <div className="mt-1 space-y-1">
                              {dayEvents.slice(0, 3).map(event => {
                                const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
                                return (
                                  <div
                                    key={event.id}
                                    onClick={(e) => handleEventClick(event, e)}
                                    className="text-xs px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80"
                                    style={{ backgroundColor: event.color || config.color }}
                                  >
                                    {event.title}
                                  </div>
                                );
                              })}
                              {dayEvents.length > 3 && (
                                <div className="text-xs text-gray-500 px-1">
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
              </div>

              {/* Event Type Legend */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex flex-wrap gap-3">
                  {Object.entries(eventTypeConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color }}></div>
                      <span className="text-xs text-gray-600">{config.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <CalendarSidebar 
            upcomingEvents={upcomingEvents} 
            eventTypeConfig={eventTypeConfig}
            onEventClick={setSelectedEvent}
          />
        </div>
      </div>

      {/* Event Dialog */}
      {showEventDialog && (
        <EventDialog
          open={showEventDialog}
          onOpenChange={setShowEventDialog}
          selectedDate={selectedDate}
          clients={clients}
          proposals={proposals}
          eventTypeConfig={eventTypeConfig}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })}
        />
      )}

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          open={!!selectedEvent}
          onOpenChange={(open) => !open && setSelectedEvent(null)}
          eventTypeConfig={eventTypeConfig}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })}
        />
      )}

      {/* Sync Settings Dialog */}
      <CalendarSyncSettings 
        open={showSyncSettings}
        onOpenChange={setShowSyncSettings}
      />
    </div>
  );
}