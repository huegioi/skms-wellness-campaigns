import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Mail, Bell, Clock, AlertCircle, CheckCircle2, 
  Users, Award, Dumbbell, Package, MessageSquare, ChevronDown, ChevronRight, CalendarPlus
} from 'lucide-react';
import { downloadICS } from '@/lib/ics';
import { format, subDays, differenceInDays, isPast, isToday } from 'date-fns';

// Events ingested from Google Calendar carry the invite body verbatim, which is
// HTML — Google wraps pasted content in nested <table> scaffolding. Rendered as
// plain text on the client's timeline that shows up as a wall of raw tags, so
// strip markup down to readable prose before display.
//
// Also drops the bookkeeping lines the sheet mirror writes into descriptions
// ("[Removed from sheet — client link preserved]", "Source: Events"). Those are
// internal provenance notes and mean nothing to a client.
function cleanEventDescription(raw) {
  if (!raw) return '';
  let text = String(raw);
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<\s*(br|\/p|\/div|\/tr|\/li)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }
  const INTERNAL_LINE = /^\s*(\[Removed from sheet[^\]]*\]|Source:|Client:)/i;
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !INTERNAL_LINE.test(l))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function ClientTimeline({ events, proposal }) {
  const [pastExpanded, setPastExpanded] = useState(false);
  const eventTypeConfig = {
    meeting: { label: 'Client Meeting', color: '#013f7c', icon: Users },
    workshop: { label: 'Workshop', color: '#264d44', icon: Award },
    challenge: { label: '14-Day Challenge', color: '#ff9878', icon: Dumbbell },
    leadership: { label: 'Leadership Workshop', color: '#770142', icon: Award },
    class: { label: 'Weekly Class', color: '#cae5e3', icon: Dumbbell },
    delivery: { label: 'Wellness Box Delivery', color: '#eaf995', icon: Package },
    follow_up: { label: 'Proposal Follow-up', color: '#441d37', icon: MessageSquare },
    other: { label: 'Other', color: '#666', icon: Clock }
  };

  // Generate timeline items including email reminders
  const generateTimelineItems = () => {
    const items = [];

    events.forEach(event => {
      const eventDate = new Date(event.start_date);
      const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;

      // 2 weeks before - Send announcement email
      const twoWeeksBefore = subDays(eventDate, 14);
      items.push({
        id: `${event.id}-2weeks`,
        date: twoWeeksBefore,
        type: 'email_announcement',
        title: `Send Announcement Email: ${event.title}`,
        description: `Send the announcement email to employees about the upcoming ${config.label.toLowerCase()}.`,
        relatedEvent: event,
        icon: Mail,
        color: '#013f7c',
        isReminder: true
      });

      // 2 days before - Send reminder email
      const twoDaysBefore = subDays(eventDate, 2);
      items.push({
        id: `${event.id}-2days`,
        date: twoDaysBefore,
        type: 'email_reminder',
        title: `Send Reminder Email: ${event.title}`,
        description: `Send the reminder email to employees. The ${config.label.toLowerCase()} is in 2 days!`,
        relatedEvent: event,
        icon: Bell,
        color: '#ff9878',
        isReminder: true
      });

      // For challenges - 3 days before app notifications start
      if (event.event_type === 'challenge') {
        const threeDaysBefore = subDays(eventDate, 3);
        items.push({
          id: `${event.id}-app-notif`,
          date: threeDaysBefore,
          type: 'app_notification',
          title: `App Notifications Begin: ${event.title}`,
          description: `Employees who signed up for the challenge will start receiving app notifications to prepare for the challenge start.`,
          relatedEvent: event,
          icon: AlertCircle,
          color: '#770142',
          isReminder: true,
          isNotification: true
        });
      }

      // The actual event
      items.push({
        id: event.id,
        date: eventDate,
        type: 'event',
        title: event.title,
        description: cleanEventDescription(event.description) || `${config.label} event`,
        event: event,
        icon: config.icon,
        color: config.color,
        isEvent: true,
        completed: event.completed,
        completed_date: event.completed_date
      });
    });

    // Sort by date
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  };

  const timelineItems = generateTimelineItems();

  const getItemStatus = (item) => {
    // If event is marked completed, always show as past
    if (item.completed) return 'past';
    
    const itemDate = new Date(item.date);
    if (isPast(itemDate) && !isToday(itemDate)) return 'past';
    if (isToday(itemDate)) return 'today';
    return 'future';
  };

  const getDaysUntil = (date) => {
    const days = differenceInDays(new Date(date), new Date());
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${Math.abs(days)} days ago`;
    return `In ${days} days`;
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Events Scheduled Yet</h3>
          <p className="text-gray-500">Your event timeline will appear here once events are scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-navy"></div>
              <span className="text-sm text-gray-600">Announcement Email (2 weeks before)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-peach"></div>
              <span className="text-sm text-gray-600">Reminder Email (2 days before)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-plum"></div>
              <span className="text-sm text-gray-600">App Notifications (3 days before challenge)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-green"></div>
              <span className="text-sm text-gray-600">Event Day</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Program Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const pastItems = timelineItems.filter(item => getItemStatus(item) === 'past');
            const upcomingItems = timelineItems.filter(item => getItemStatus(item) !== 'past');

            const renderItem = (item) => {
              const status = getItemStatus(item);
              const Icon = item.icon;
              return (
                <div key={item.id} className="relative pl-12">
                  <div 
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      status === 'past' ? 'bg-gray-100 border-gray-300' :
                      status === 'today' ? 'bg-white border-brand-plum ring-4 ring-brand-plum/20' :
                      'bg-white border-gray-300'
                    }`}
                    style={{ 
                      borderColor: status !== 'past' ? item.color : undefined,
                      backgroundColor: status === 'past' ? '#f3f4f6' : 'white'
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: status === 'past' ? '#9ca3af' : item.color }} />
                  </div>
                  <div className={`p-4 rounded-lg border ${
                    status === 'past' ? 'bg-gray-50 border-gray-200' :
                    status === 'today' ? 'bg-white border-brand-plum shadow-md' :
                    'bg-white border-gray-200'
                  }`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${status === 'past' ? 'text-gray-500' : 'text-gray-800'}`}>
                          {item.title}
                        </h4>
                        {item.isReminder && (
                          <Badge variant="outline" className="text-xs">
                            {item.isNotification ? 'Auto' : 'Action Required'}
                          </Badge>
                        )}
                        {item.isEvent && (
                          <Badge style={{ backgroundColor: item.color, color: 'white' }} className="text-xs">
                            Event
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${status === 'today' ? 'font-semibold text-brand-plum' : 'text-gray-500'}`}>
                          {format(new Date(item.date), 'MMM d, yyyy')}
                        </span>
                        <Badge variant={status === 'past' ? 'secondary' : status === 'today' ? 'default' : 'outline'}>
                          {getDaysUntil(item.date)}
                        </Badge>
                        {item.isEvent && status !== 'past' && (
                          <button
                            onClick={() => downloadICS({
                              id: item.event.id,
                              title: item.event.title,
                              start: item.event.start_date,
                              end: item.event.end_date,
                              location: item.event.location,
                              description: item.event.description,
                            })}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-green hover:bg-gray-100 transition-colors"
                            title="Add to calendar"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm ${status === 'past' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {item.description}
                    </p>
                    {status === 'past' && !item.isReminder && (
                      <div className="flex items-center gap-1 mt-2 text-green-600 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        {item.completed ? 'Completed' : 'Past Event'}
                      </div>
                    )}
                    {item.completed && item.completed_date && (
                      <div className="text-xs text-gray-500 mt-1">
                        Completed on {format(new Date(item.completed_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-6">
                  {/* Past events collapsible */}
                  {pastItems.length > 0 && (
                    <div>
                      <button
                        onClick={() => setPastExpanded(!pastExpanded)}
                        className="flex items-center gap-2 mb-4 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors ml-12"
                      >
                        {pastExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {pastItems.length} Past Event{pastItems.length !== 1 ? 's' : ''}
                      </button>
                      {pastExpanded && (
                        <div className="space-y-6 mb-6">
                          {pastItems.map(renderItem)}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Upcoming events */}
                  {upcomingItems.map(renderItem)}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}