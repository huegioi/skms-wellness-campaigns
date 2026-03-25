import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Calendar, Clock, PhoneCall, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusConfig = {
  needs_followup: { label: 'Needs Follow-Up', color: 'bg-amber-100 text-amber-800' },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  booked: { label: 'Session Booked', color: 'bg-green-100 text-green-700' },
  snoozed: { label: 'Snoozed', color: 'bg-gray-100 text-gray-600' }
};

export default function FollowUpSettings({ client, onUpdate }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    last_service_date: client.last_service_date || '',
    follow_up_window_days: client.follow_up_window_days || 90,
    last_contacted_date: client.last_contacted_date || '',
    follow_up_status: client.follow_up_status || ''
  });

  const handleSave = async () => {
    await onUpdate(form);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast.success('Follow-up settings saved');
  };

  const handleSnooze = async () => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 7);
    const updates = { follow_up_status: 'snoozed', snooze_until: snoozeUntil.toISOString().split('T')[0] };
    await onUpdate(updates);
    setForm(f => ({ ...f, follow_up_status: 'snoozed' }));
    toast.success('Snoozed for 1 week');
  };

  const currentStatus = client.follow_up_status;
  const statusInfo = statusConfig[currentStatus];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" />
            Follow-Up Settings
          </div>
          {statusInfo && (
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Last Service Date
            </label>
            <Input
              type="date"
              value={form.last_service_date}
              onChange={e => setForm(f => ({ ...f, last_service_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Follow-Up Window (days)
            </label>
            <Input
              type="number"
              min="1"
              value={form.follow_up_window_days}
              onChange={e => setForm(f => ({ ...f, follow_up_window_days: parseInt(e.target.value) || 90 }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5" /> Last Contacted Date
            </label>
            <Input
              type="date"
              value={form.last_contacted_date}
              onChange={e => setForm(f => ({ ...f, last_contacted_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Status
            </label>
            <Select
              value={form.follow_up_status || 'none'}
              onValueChange={v => setForm(f => ({ ...f, follow_up_status: v === 'none' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                <SelectItem value="needs_followup">Needs Follow-Up</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="booked">Session Booked</SelectItem>
                <SelectItem value="snoozed">Snoozed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {client.snooze_until && client.follow_up_status === 'snoozed' && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
            Snoozed until: <strong>{new Date(client.snooze_until).toLocaleDateString()}</strong>
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button className="bg-[#264d44] hover:bg-[#1a3830] flex-1" onClick={handleSave}>
            Save Settings
          </Button>
          <Button variant="outline" onClick={handleSnooze} className="text-gray-600">
            <Clock className="w-4 h-4 mr-1" /> Snooze 1 Week
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}