import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Bell, CalendarPlus, PhoneCall, Clock, Building, AlertTriangle, Leaf, Snowflake, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

function getFollowUpReason(client) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  // April check-in: trigger in March & April if not done this year
  if ([3, 4].includes(currentMonth) && client.april_checkin_year !== currentYear) {
    return { label: 'April Check-in Due', icon: Leaf, color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
  }

  // November check-in: trigger in October & November if not done this year
  if ([10, 11].includes(currentMonth) && client.november_checkin_year !== currentYear) {
    return { label: 'November Check-in Due', icon: Snowflake, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
  }

  // 90-day rolling window
  if (client.last_service_date) {
    const windowDays = client.follow_up_window_days || 90;
    const lastService = new Date(client.last_service_date);
    const dueDate = new Date(lastService);
    dueDate.setDate(dueDate.getDate() + windowDays);
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    if (dueDate <= today) {
      return {
        label: daysOverdue === 0 ? 'Follow-up Due Today' : `${daysOverdue}d Overdue`,
        icon: AlertTriangle,
        color: daysOverdue > 14 ? 'text-red-600' : 'text-amber-600',
        bg: daysOverdue > 14 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      };
    }
  }

  return null;
}

function needsFollowUp(client) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Skip if snoozed
  if (client.follow_up_status === 'snoozed' && client.snooze_until) {
    if (new Date(client.snooze_until) > today) return false;
  }

  // April check-in
  if ([3, 4].includes(currentMonth) && client.april_checkin_year !== currentYear) return true;

  // November check-in
  if ([10, 11].includes(currentMonth) && client.november_checkin_year !== currentYear) return true;

  // Rolling window
  if (client.last_service_date) {
    const windowDays = client.follow_up_window_days || 90;
    const dueDate = new Date(client.last_service_date);
    dueDate.setDate(dueDate.getDate() + windowDays);
    if (dueDate <= today && client.follow_up_status !== 'booked') return true;
  }

  return false;
}

function BookSessionDialog({ client, open, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [loading, setLoading] = useState(false);

  const handleBook = async () => {
    if (!startDate) return;
    setLoading(true);
    try {
      await base44.functions.invoke('bookFollowUpSession', {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        startDate,
        startTime,
        duration: parseInt(duration)
      });
      onClose(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Book Check-in Call</DialogTitle>
        </DialogHeader>
        {client && (
        <div className="space-y-4 mt-2">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-700">Event Title:</p>
            <p className="text-gray-600 mt-1">SkillfulMeans Wellness Services Check-in Call with {client.company || client.name}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Start Time</label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Duration (min)</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">A Google Meet link will be created and the client will be invited as a guest.</p>
          <Button
            className="w-full bg-[#264d44] hover:bg-[#1a3830]"
            onClick={handleBook}
            disabled={!startDate || loading}
          >
            <CalendarPlus className="w-4 h-4 mr-2" />
            {loading ? 'Booking...' : 'Book & Send Invite'}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FollowUpQueue() {
  const queryClient = useQueryClient();
  const [bookingClient, setBookingClient] = useState(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const queueClients = clients.filter(needsFollowUp);

  const markContacted = async (client) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const updates = {
      follow_up_status: 'contacted',
      last_contacted_date: today.toISOString().split('T')[0]
    };

    if ([3, 4].includes(currentMonth)) updates.april_checkin_year = currentYear;
    if ([10, 11].includes(currentMonth)) updates.november_checkin_year = currentYear;

    await base44.entities.Client.update(client.id, updates);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast.success(`${client.name} marked as contacted`);
  };

  const snoozeClient = async (client) => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 7);
    await base44.entities.Client.update(client.id, {
      follow_up_status: 'snoozed',
      snooze_until: snoozeUntil.toISOString().split('T')[0]
    });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast.success(`${client.name} snoozed for 1 week`);
  };

  const removeFromQueue = async (client) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    await base44.entities.Client.update(client.id, {
      follow_up_status: 'contacted',
      last_contacted_date: today.toISOString().split('T')[0],
      april_checkin_year: currentYear,
      november_checkin_year: currentYear
    });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast.success(`${client.name} removed from follow-up queue`);
  };

  if (isLoading) return null;
  if (queueClients.length === 0) return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-green-800">
          <Bell className="w-6 h-6" />
          Follow-Up Queue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-green-700 text-sm">All clients are up to date — no follow-ups needed right now! 🎉</p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl text-amber-800">
              <Bell className="w-6 h-6" />
              Follow-Up Queue
            </div>
            <Badge className="bg-amber-500 text-white">{queueClients.length} client{queueClients.length !== 1 ? 's' : ''}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {queueClients.map(client => {
              const reason = getFollowUpReason(client);
              const ReasonIcon = reason?.icon || AlertTriangle;
              return (
                <div key={client.id} className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${reason?.bg || 'border-gray-200'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{client.name}</p>
                      {client.company && (
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <Building className="w-3 h-3" /> {client.company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {reason && (
                        <Badge variant="outline" className={`text-xs ${reason.color} border-current`}>
                          <ReasonIcon className="w-3 h-3 mr-1" />
                          {reason.label}
                        </Badge>
                      )}
                      {client.last_service_date && (
                        <span className="text-xs text-gray-500">🗓 Last service: <strong>{new Date(client.last_service_date).toLocaleDateString()}</strong></span>
                      )}
                      {client.last_contacted_date && (
                        <span className="text-xs text-gray-500">📞 Last contacted: <strong>{new Date(client.last_contacted_date).toLocaleDateString()}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <Link to={createPageUrl('Clients') + `?clientId=${client.id}`}>
                      <Button size="sm" variant="outline" className="text-[#013f7c] border-[#013f7c]">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="bg-[#264d44] hover:bg-[#1a3830] text-white"
                      onClick={() => setBookingClient(client)}
                    >
                      <CalendarPlus className="w-4 h-4 mr-1" />
                      Book
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-500 text-green-700 hover:bg-green-50"
                      onClick={() => markContacted(client)}
                    >
                      <PhoneCall className="w-4 h-4 mr-1" />
                      Contacted
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-500"
                      onClick={() => snoozeClient(client)}
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Snooze
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeFromQueue(client)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <BookSessionDialog
        client={bookingClient}
        open={!!bookingClient}
        onClose={() => setBookingClient(null)}
      />
    </>
  );
}