import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { DollarSign, CheckCircle2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n) => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function PresenterPayouts() {
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: presenters = [] } = useQuery({
    queryKey: ['presenters'],
    queryFn: () => base44.entities.Presenter.list('name')
  });

  // Fetch all completed events that have a presenter_id
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['presenter-payout-events'],
    queryFn: () => base44.entities.CalendarEvent.filter({ completed: true })
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ eventId }) =>
      base44.entities.CalendarEvent.update(eventId, {
        presenter_paid: true,
        presenter_paid_date: format(new Date(), 'yyyy-MM-dd')
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presenter-payout-events'] });
      toast.success('Session marked as paid');
    }
  });

  const markAllPaidMutation = useMutation({
    mutationFn: async (pendingSessions) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      await Promise.all(
        pendingSessions.map(e =>
          base44.entities.CalendarEvent.update(e.id, {
            presenter_paid: true,
            presenter_paid_date: today
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presenter-payout-events'] });
      toast.success('All pending sessions marked as paid');
    }
  });

  // Group completed events by presenter_id
  const eventsById = {};
  for (const ev of allEvents) {
    if (!ev.presenter_id) continue;
    if (!eventsById[ev.presenter_id]) eventsById[ev.presenter_id] = [];
    eventsById[ev.presenter_id].push(ev);
  }

  const getSessionFee = (ev, presenter) => {
    if (ev.presenter_fee != null && ev.presenter_fee !== '') return Number(ev.presenter_fee);
    if (presenter?.default_rate != null) return Number(presenter.default_rate);
    return null;
  };

  const presenterRows = presenters.map(p => {
    const sessions = eventsById[p.id] || [];
    const pending = sessions.filter(e => !e.presenter_paid);
    const paid = sessions.filter(e => e.presenter_paid);
    const pendingTotal = pending.reduce((s, e) => s + (getSessionFee(e, p) || 0), 0);
    const paidTotal = paid.reduce((s, e) => s + (getSessionFee(e, p) || 0), 0);
    return { presenter: p, sessions, pending, paid, pendingTotal, paidTotal };
  }).filter(r => r.sessions.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (presenterRows.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No completed sessions yet</p>
        <p className="text-sm mt-1">Payout data will appear once sessions are marked complete.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {presenterRows.map(({ presenter, sessions, pending, paid, pendingTotal, paidTotal }) => {
        const isExpanded = expandedId === presenter.id;
        return (
          <Card key={presenter.id} className="bg-white overflow-hidden">
            {/* Presenter header row */}
            <button
              className="w-full text-left p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : presenter.id)}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{presenter.name}</p>
                <p className="text-sm text-gray-500">{sessions.length} completed session{sessions.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0 text-right">
                <div>
                  <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pending</p>
                  <p className="text-lg font-bold text-amber-700">{fmt(pendingTotal)}</p>
                  <p className="text-xs text-gray-400">{pending.length} session{pending.length !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Paid</p>
                  <p className="text-lg font-bold text-green-700">{fmt(paidTotal)}</p>
                  <p className="text-xs text-gray-400">{paid.length} session{paid.length !== 1 ? 's' : ''}</p>
                </div>
                {pending.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllPaidMutation.mutate(pending);
                    }}
                    disabled={markAllPaidMutation.isPending}
                  >
                    Mark all paid
                  </Button>
                )}
              </div>
            </button>

            {/* Session rows */}
            {isExpanded && (
              <div className="border-t divide-y divide-gray-100">
                {sessions
                  .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
                  .map(ev => {
                    const fee = getSessionFee(ev, presenter);
                    const isPaid = ev.presenter_paid === true;
                    return (
                      <div key={ev.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{ev.title}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span>{format(parseISO(ev.start_date), 'MMM d, yyyy')}</span>
                            {ev.client_name && <span>· {ev.client_name}</span>}
                            {ev.presenter_fee != null && ev.presenter_fee !== '' && (
                              <span className="text-purple-600">· override rate</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-semibold text-gray-800 w-20 text-right">{fmt(fee)}</span>
                          {isPaid ? (
                            <Badge className="bg-green-100 text-green-700 gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                              {ev.presenter_paid_date && (
                                <span className="font-normal opacity-70">
                                  {' '}· {format(parseISO(ev.presenter_paid_date), 'MMM d')}
                                </span>
                              )}
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-amber-100 text-amber-700 gap-1">
                                <Clock className="w-3 h-3" />
                                Pending
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-green-400 text-green-700 hover:bg-green-50"
                                onClick={() => markPaidMutation.mutate({ eventId: ev.id })}
                                disabled={markPaidMutation.isPending}
                              >
                                Mark Paid
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}