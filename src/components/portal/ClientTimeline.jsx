import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Mail, Bell, Clock, AlertCircle, CheckCircle2, 
  Users, Award, Dumbbell, Package, MessageSquare
} from 'lucide-react';
import { format, subDays, differenceInDays, isPast, isToday, isFuture } from 'date-fns';

export default function ClientTimeline({ events, proposal }) {
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
        description: event.description || `${config.label} event`,
        event: event,
        icon: config.icon,
        color: config.color,
        isEvent: true
      });
    });

    // Sort by date
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  };

  const timelineItems = generateTimelineItems();

  const getItemStatus = (item) => {
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
              <div className="w-3 h-3 rounded-full bg-[#013f7c]"></div>
              <span className="text-sm text-gray-600">Announcement Email (2 weeks before)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff9878]"></div>
              <span className="text-sm text-gray-600">Reminder Email (2 days before)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#770142]"></div>
              <span className="text-sm text-gray-600">App Notifications (3 days before challenge)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#264d44]"></div>
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
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            <div className="space-y-6">
              {timelineItems.map((item, index) => {
                const status = getItemStatus(item);
                const Icon = item.icon;
                
                return (
                  <div key={item.id} className="relative pl-12">
                    {/* Circle marker */}
                    <div 
                      className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        status === 'past' ? 'bg-gray-100 border-gray-300' :
                        status === 'today' ? 'bg-white border-[#770142] ring-4 ring-[#770142]/20' :
                        'bg-white border-gray-300'
                      }`}
                      style={{ 
                        borderColor: status !== 'past' ? item.color : undefined,
                        backgroundColor: status === 'past' ? '#f3f4f6' : 'white'
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: status === 'past' ? '#9ca3af' : item.color }} />
                    </div>

                    {/* Content */}
                    <div 
                      className={`p-4 rounded-lg border ${
                        status === 'past' ? 'bg-gray-50 border-gray-200' :
                        status === 'today' ? 'bg-white border-[#770142] shadow-md' :
                        'bg-white border-gray-200'
                      }`}
                    >
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
                          <span className={`text-sm ${status === 'today' ? 'font-semibold text-[#770142]' : 'text-gray-500'}`}>
                            {format(new Date(item.date), 'MMM d, yyyy')}
                          </span>
                          <Badge variant={status === 'past' ? 'secondary' : status === 'today' ? 'default' : 'outline'}>
                            {getDaysUntil(item.date)}
                          </Badge>
                        </div>
                      </div>
                      <p className={`text-sm ${status === 'past' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.description}
                      </p>
                      
                      {status === 'past' && (
                        <div className="flex items-center gap-1 mt-2 text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Completed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}