import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashClients, useDashInteractions } from './useDashboardData';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Bell, CalendarPlus, PhoneCall, Clock, Building, AlertTriangle, X, ExternalLink, RefreshCw, StickyNote } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import LeadsAttentionSection from '@/components/dashboard/LeadsAttentionSection';
import UnscheduledServicesSection from '@/components/dashboard/UnscheduledServicesSection';
import PresenterAttentionSection from '@/components/dashboard/PresenterAttentionSection';
import RenewalSeasonSection from '@/components/dashboard/RenewalSeasonSection';
import { CHANNEL_ICONS, CHANNEL_LABELS, getFollowUpReason, needsFollowUp } from '@/lib/followUpLogic';

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
  const [syncing, setSyncing] = useState(false);

  const syncEmails = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('scanAdminGmailContacts', {});
      queryClient.invalidateQueries({ queryKey: ['dash-clients'] });
      toast.success(`Email sync complete — ${res.data?.updated || 0} client(s) updated`);
    } catch (e) {
      toast.error('Email sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const { data: rawClients = [], isLoading } = useDashClients();

  // Exclude demo/broker-demo records from dashboard metrics
  const clients = rawClients.filter(c => !c.is_demo);

  // Fetch interactions to derive days-since-contact + last touch channel
  const { data: interactions = [] } = useDashInteractions();

  // Latest interaction per client_id
  const latestInteractionByClient = useMemo(() => {
    const map = {};
    for (const i of interactions) {
      if (!i.client_id) continue;
      if (!map[i.client_id] || new Date(i.date) > new Date(map[i.client_id].date)) {
        map[i.client_id] = i;
      }
    }
    return map;
  }, [interactions]);

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
    queryClient.invalidateQueries({ queryKey: ['dash-clients'] });
    toast.success(`${client.name} marked as contacted`);
  };

  const snoozeClient = async (client) => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 7);
    await base44.entities.Client.update(client.id, {
      follow_up_status: 'snoozed',
      snooze_until: snoozeUntil.toISOString().split('T')[0]
    });
    queryClient.invalidateQueries({ queryKey: ['dash-clients'] });
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
    queryClient.invalidateQueries({ queryKey: ['dash-clients'] });
    toast.success(`${client.name} removed from follow-up queue`);
  };

  if (isLoading) return <PresenterAttentionSection />;
  if (queueClients.length === 0) return (
    <>
    <PresenterAttentionSection />
    <RenewalSeasonSection />
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
    </>
  );

  return (
    <>
    <PresenterAttentionSection />
    <RenewalSeasonSection />
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl text-amber-800">
              <Bell className="w-6 h-6" />
              Follow-Up Queue
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={syncEmails} disabled={syncing} className="text-xs">
                <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Emails'}
              </Button>
              <Badge className="bg-amber-500 text-white">{queueClients.length} client{queueClients.length !== 1 ? 's' : ''}</Badge>
            </div>
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
                      {(() => {
                        const latest = latestInteractionByClient[client.id];
                        const touchDate = latest?.date || client.last_contacted_date;
                        const touchChannel = latest?.channel || 'other';
                        const ChannelIcon = CHANNEL_ICONS[touchChannel] || StickyNote;
                        const daysSince = touchDate ? Math.floor((new Date() - new Date(touchDate)) / 86400000) : null;
                        return daysSince !== null ? (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <ChannelIcon className="w-3 h-3" />
                            {CHANNEL_LABELS[touchChannel] || 'Touch'} · {daysSince}d ago
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No contact yet</span>
                        );
                      })()}
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

      <LeadsAttentionSection />

      <UnscheduledServicesSection />

      <BookSessionDialog
        client={bookingClient}
        open={!!bookingClient}
        onClose={() => setBookingClient(null)}
      />
    </>
  );
}