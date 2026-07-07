import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Circle, CalendarPlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_TO_EVENT_TYPE = {
  workshop: 'workshop',
  challenge: 'challenge',
  leadership: 'leadership',
  class: 'class',
  wellness_box: 'delivery',
  other: 'other',
};

function formatLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:00`;
}

/**
 * To-schedule checklist shown when SchedulingHub is deep-linked with
 * ?clientId=X&proposalId=Y. Lists services from accepted proposals that
 * have no matching CalendarEvent; inline form creates the event prefilled
 * with service_id, client_id, proposal_id.
 */
export default function ScheduleChecklist({ clientId, proposalId, proposals, calendarEvents, allServices, allClients, onClose }) {
  const queryClient = useQueryClient();
  const [schedulingId, setSchedulingId] = useState(null);
  const [form, setForm] = useState({ start_date: '', start_time: '09:00', location: '' });
  const [saving, setSaving] = useState(false);

  const client = allClients.find(c => c.id === clientId);

  const acceptedProposals = useMemo(() =>
    proposals.filter(p => p.client_id === clientId && p.status === 'accepted'),
    [proposals, clientId]
  );

  const acceptedProposalIds = useMemo(() => new Set(acceptedProposals.map(p => p.id)), [acceptedProposals]);

  // Selected services across all accepted proposals, with source proposal
  const selectedServices = useMemo(() => {
    const map = {};
    const enrichMap = [
      ['workshopsData', 'workshop', 'workshops'],
      ['challengeProgramsData', 'challenge', 'challengePrograms'],
      ['leadershipData', 'leadership', 'leadership'],
      ['movementClassesData', 'class', 'movementClasses'],
    ];
    for (const proposal of acceptedProposals) {
      const sel = proposal.selections || {};
      for (const [dataKey, cat, fallbackKey] of enrichMap) {
        const enriched = sel[dataKey] || [];
        const fallback = sel[fallbackKey] || [];
        if (enriched.length > 0) {
          for (const svc of enriched) {
            if (svc.id && !map[svc.id]) map[svc.id] = { id: svc.id, name: svc.name || svc.id, category: cat, proposalId: proposal.id };
          }
        } else {
          for (const id of fallback) {
            if (!map[id]) map[id] = { id, name: id, category: cat, proposalId: proposal.id };
          }
        }
      }
    }
    // Enrich names/categories from DB services
    for (const s of allServices) {
      if (map[s.id]) {
        if (!map[s.id].name || map[s.id].name === map[s.id].id) map[s.id].name = s.name;
        if (s.category) map[s.id].category = s.category;
      }
    }
    return Object.values(map);
  }, [acceptedProposals, allServices]);

  const linkedEvents = useMemo(() =>
    calendarEvents.filter(e => e.client_id === clientId || (e.proposal_id && acceptedProposalIds.has(e.proposal_id))),
    [calendarEvents, clientId, acceptedProposalIds]
  );

  const scheduledMap = useMemo(() => {
    const map = {};
    for (const e of linkedEvents) {
      if (e.service_id && selectedServices.find(s => s.id === e.service_id)) {
        if (!map[e.service_id] || new Date(e.start_date) > new Date(map[e.service_id].start_date)) {
          map[e.service_id] = e;
        }
      }
    }
    return map;
  }, [linkedEvents, selectedServices]);

  const unscheduled = selectedServices.filter(s => !scheduledMap[s.id]);

  const handleSchedule = async (svc) => {
    if (!form.start_date) { toast.error('Pick a date'); return; }
    setSaving(true);
    try {
      const startDateTime = `${form.start_date}T${form.start_time || '09:00'}:00`;
      const endDate = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000);
      await base44.entities.CalendarEvent.create({
        title: svc.name,
        description: '',
        location: form.location || '',
        start_date: startDateTime,
        end_date: formatLocalISO(endDate),
        all_day: false,
        event_type: CATEGORY_TO_EVENT_TYPE[svc.category] || 'other',
        client_name: client?.name || client?.company || '',
        client_id: clientId,
        service_id: svc.id,
        proposal_id: svc.proposalId || proposalId || '',
        color: '#264d44',
      });
      await queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      toast.success(`${svc.name} scheduled`);
      setSchedulingId(null);
      setForm({ start_date: '', start_time: '09:00', location: '' });
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (selectedServices.length === 0) {
    return (
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-center justify-between">
          <p className="text-sm text-amber-700">No accepted-proposal services found for this client.</p>
          {onClose && <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-[#264d44]/30 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: '#264d44' }}>
              <CalendarPlus className="w-5 h-5" />
              To-Schedule Checklist
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {client?.company || client?.name} • {unscheduled.length} of {selectedServices.length} unscheduled
            </p>
          </div>
          {onClose && <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {selectedServices.map(svc => {
          const scheduled = scheduledMap[svc.id];
          if (schedulingId === svc.id) {
            return (
              <div key={svc.id} className="border-2 border-[#264d44] rounded-lg p-3 bg-[#264d44]/5 space-y-2">
                <p className="font-semibold text-sm text-gray-800">{svc.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500">Date</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-gray-500">Time</Label>
                    <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="h-8 text-sm" />
                  </div>
                </div>
                <Input placeholder="Location (optional)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#264d44] hover:bg-[#1a3830] flex-1" disabled={saving || !form.start_date} onClick={() => handleSchedule(svc)}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSchedulingId(null)}>Cancel</Button>
                </div>
              </div>
            );
          }
          return (
            <div key={svc.id} className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${scheduled ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 min-w-0">
                {scheduled ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Circle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{svc.name}</p>
                  {scheduled ? (
                    <p className="text-xs text-green-600">
                      Scheduled — {new Date(scheduled.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 capitalize">{svc.category}</p>
                  )}
                </div>
              </div>
              {!scheduled && (
                <Button
                  size="sm"
                  className="bg-[#264d44] hover:bg-[#1a3830] h-7 text-xs"
                  onClick={() => { setSchedulingId(svc.id); setForm({ start_date: '', start_time: '09:00', location: '' }); }}
                >
                  Schedule
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}