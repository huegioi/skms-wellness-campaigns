import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MessageSquare, Linkedin, Video, StickyNote, CalendarPlus, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LogTouchDialog from '@/components/dashboard/LogTouchDialog';
import EventDialog from '@/components/calendar/EventDialog';

const CHANNEL_ICONS = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
  meeting: Video,
  other: StickyNote,
};

const CHANNEL_LABELS = {
  email: 'Email',
  call: 'Call',
  text: 'Text',
  linkedin: 'LinkedIn',
  meeting: 'Meeting',
  other: 'Note',
};

const CLOSED_STATUSES = new Set(['converted', 'not_interested', 'current_client']);

const EVENT_TYPE_CONFIG = {
  meeting: { label: 'Meeting', color: '#3B82F6' },
  follow_up: { label: 'Follow Up', color: '#14B8A6' },
  other: { label: 'Other', color: '#264d44' },
};

export default function LeadsAttentionSection() {
  const queryClient = useQueryClient();
  const [logTouchLead, setLogTouchLead] = useState(null);
  const [bookCallLead, setBookCallLead] = useState(null);

  const { data: rawLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500)
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions-lead-attention'],
    queryFn: () => base44.entities.ClientInteraction.list('-date', 500)
  });

  const { data: rawCalendarEvents = [] } = useQuery({
    queryKey: ['calendar-events-lead-attention'],
    queryFn: () => base44.entities.CalendarEvent.list('start_date', 200)
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const leads = rawLeads.filter(l => !l.is_demo);
  const calendarEvents = rawCalendarEvents.filter(e => !e.is_demo);

  // Latest interaction per lead_id
  const latestInteractionByLead = useMemo(() => {
    const map = {};
    for (const i of interactions) {
      if (!i.lead_id) continue;
      if (!map[i.lead_id] || new Date(i.date) > new Date(map[i.lead_id].date)) {
        map[i.lead_id] = i;
      }
    }
    return map;
  }, [interactions]);

  // Set of lead_ids that have an upcoming CalendarEvent
  const upcomingEventLeadIds = useMemo(() => {
    const now = new Date();
    const set = new Set();
    for (const e of calendarEvents) {
      if (!e.lead_id) continue;
      if (new Date(e.start_date) >= now) set.add(e.lead_id);
    }
    return set;
  }, [calendarEvents]);

  // Leads needing attention: past next_followup_date, or no upcoming event + no touch in 7+ days
  const attentionLeads = useMemo(() => {
    const now = new Date();
    return leads.filter(lead => {
      if (CLOSED_STATUSES.has(lead.status)) return false;

      // Condition 1: next_followup_date is past
      if (lead.next_followup_date && new Date(lead.next_followup_date) < now) return true;

      // Condition 2: no upcoming CalendarEvent AND no touch in 7+ days
      if (upcomingEventLeadIds.has(lead.id)) return false;

      const latest = latestInteractionByLead[lead.id];
      const touchDate = latest?.date || lead.last_contacted_date;
      if (!touchDate) return true; // No touch at all

      const daysSince = Math.floor((now - new Date(touchDate)) / 86400000);
      return daysSince >= 7;
    });
  }, [leads, latestInteractionByLead, upcomingEventLeadIds]);

  if (attentionLeads.length === 0) return null;

  return (
    <>
      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl text-orange-800">
              <AlertTriangle className="w-6 h-6" />
              Leads Needing Attention
            </div>
            <Badge className="bg-orange-500 text-white">{attentionLeads.length} lead{attentionLeads.length !== 1 ? 's' : ''}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {attentionLeads.map(lead => {
              const latest = latestInteractionByLead[lead.id];
              const touchDate = latest?.date || lead.last_contacted_date;
              const touchChannel = latest?.channel || lead.outreach_channel || 'other';
              const ChannelIcon = CHANNEL_ICONS[touchChannel] || StickyNote;
              const daysSince = touchDate ? Math.floor((new Date() - new Date(touchDate)) / 86400000) : null;
              const isOverdueFollowup = lead.next_followup_date && new Date(lead.next_followup_date) < new Date();

              return (
                <div key={lead.id} className="bg-white rounded-xl border border-orange-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{lead.name}</p>
                      {lead.company && (
                        <span className="text-gray-500 text-sm">{lead.company}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {isOverdueFollowup ? (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                          <Clock className="w-3 h-3 mr-1" />
                          Follow-up overdue
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          No touch in {daysSince ?? '∞'}d
                        </Badge>
                      )}
                      {daysSince !== null ? (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <ChannelIcon className="w-3 h-3" />
                          {CHANNEL_LABELS[touchChannel] || 'Touch'} · {daysSince}d ago
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No contact yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#264d44] text-[#264d44] hover:bg-[#264d44]/5"
                      onClick={() => setLogTouchLead(lead)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Log Touch
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#264d44] hover:bg-[#1a3830] text-white"
                      onClick={() => setBookCallLead(lead)}
                    >
                      <CalendarPlus className="w-4 h-4 mr-1" />
                      Book Call
                    </Button>
                    <Link to={createPageUrl('Leads') + `?leadId=${lead.id}`}>
                      <Button size="sm" variant="ghost" className="text-gray-500">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Detail
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <LogTouchDialog
        open={!!logTouchLead}
        onClose={() => setLogTouchLead(null)}
        leadId={logTouchLead?.id}
        entityName={logTouchLead?.name}
      />

      <EventDialog
        open={!!bookCallLead}
        onOpenChange={(v) => !v && setBookCallLead(null)}
        clients={[]}
        proposals={[]}
        eventTypeConfig={EVENT_TYPE_CONFIG}
        prefillLeadId={bookCallLead?.id}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['calendar-events-lead-attention'] })}
      />
    </>
  );
}