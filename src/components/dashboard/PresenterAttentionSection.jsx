import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { getEventLens } from '@/components/scheduling/eventLenses';
import { getPresenterStatus } from '@/components/scheduling/PresenterStatusIcon';

/**
 * Dashboard section for delivery sessions within 7 days that are
 * unaccepted (presenter assigned but hasn't accepted) or presenter-less
 * (no presenter assigned, including declined sessions).
 */
export default function PresenterAttentionSection() {
  const { data: events = [] } = useQuery({
    queryKey: ['calendarEvents-presenter-attention'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 500),
  });

  const now = new Date();
  const sevenDays = new Date();
  sevenDays.setDate(sevenDays.getDate() + 7);

  const needsAttention = events
    .filter(e => !e.is_demo && !e.completed)
    .filter(e => {
      const start = parseISO(e.start_date);
      return start >= now && start <= sevenDays;
    })
    .filter(e => getEventLens(e) === 'delivery')
    .filter(e => {
      const status = getPresenterStatus(e);
      return status !== 'accepted';
    })
    .sort((a, b) => {
      // Declined first, then by date
      const aDeclined = getPresenterStatus(a) === 'declined' ? 0 : 1;
      const bDeclined = getPresenterStatus(b) === 'declined' ? 0 : 1;
      if (aDeclined !== bDeclined) return aDeclined - bDeclined;
      return parseISO(a.start_date) - parseISO(b.start_date);
    });

  if (needsAttention.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-red-800">
          <AlertCircle className="w-5 h-5" />
          Presenter Needed
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {needsAttention.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {needsAttention.map(event => {
            const status = getPresenterStatus(event);
            const start = parseISO(event.start_date);
            const daysOut = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
            return (
              <div key={event.id} className="bg-white rounded-lg border p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm truncate">{event.title}</p>
                    {status === 'declined' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">
                        Needs presenter
                      </span>
                    )}
                    {status === 'assigned' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-medium">
                        Awaiting presenter
                      </span>
                    )}
                    {status === 'unassigned' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300 font-medium">
                        No presenter
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(start, 'MMM d')} · {daysOut === 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut}d`}
                    </span>
                    {event.client_name && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {event.client_name}
                      </span>
                    )}
                    {event.presenter && status === 'assigned' && (
                      <span>→ {event.presenter}</span>
                    )}
                    {event.presenter_decline_reason && status === 'declined' && (
                      <span className="italic text-gray-400">"{event.presenter_decline_reason}"</span>
                    )}
                  </div>
                </div>
                <Link to="/SchedulingHub" className="flex-shrink-0">
                  <Button size="sm" variant="outline" className="text-xs">
                    Assign
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}