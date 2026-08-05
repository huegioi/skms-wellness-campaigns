import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MessageSquare, Linkedin, Video, StickyNote, CalendarPlus, ExternalLink, AlertTriangle, Clock, ChevronRight, ChevronDown, CheckCircle2 } from 'lucide-react';
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

const ROW_CAP = 8;
const QUIET_THRESHOLD_DAYS = 14;
const FRESH_INQUIRY_DAYS = 14;

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysBetween = (a, b) => Math.floor((a - new Date(b)) / 86400000);

export default function LeadsAttentionSection() {
  const queryClient = useQueryClient();
  const [logTouchLead, setLogTouchLead] = useState(null);
  const [bookCallLead, setBookCallLead] = useState(null);
  const [cohort3Open, setCohort3Open] = useState(false);

  const { data: rawLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.filter({ is_archived: { $ne: true } }, '-created_date', 500)
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

  const now = useMemo(() => new Date(), []);

  // Fresh company inquiries (last 14 days) are surfaced by the New Inquiries card
  // and must NOT be flagged as quiet/overdue — they belong in the Cohort 3 backlog.
  const isFreshInquiry = (lead) =>
    lead.lead_type === 'company_inquiry' &&
    lead.created_date &&
    daysBetween(now, lead.created_date) <= FRESH_INQUIRY_DAYS;

  // ── Cohort 1: Overdue Follow-Ups (red, always first, never collapsed) ──
  const cohort1 = useMemo(() => {
    return leads
      .filter(lead => {
        if (CLOSED_STATUSES.has(lead.status)) return false;
        if (isFreshInquiry(lead)) return false;
        return lead.next_followup_date && new Date(lead.next_followup_date) < now;
      })
      .sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date)); // most overdue first
  }, [leads, now]);

  const cohort1Ids = useMemo(() => new Set(cohort1.map(l => l.id)), [cohort1]);

  // ── Cohort 2: Going Quiet (amber) — touched before, 14+ days quiet, no upcoming event ──
  const cohort2 = useMemo(() => {
    return leads
      .filter(lead => {
        if (CLOSED_STATUSES.has(lead.status)) return false;
        if (isFreshInquiry(lead)) return false;
        if (cohort1Ids.has(lead.id)) return false;
        if (upcomingEventLeadIds.has(lead.id)) return false;
        const latest = latestInteractionByLead[lead.id];
        const touchDate = latest?.date || lead.last_contacted_date;
        if (!touchDate) return false; // no touch → Cohort 3
        return daysBetween(now, touchDate) >= QUIET_THRESHOLD_DAYS;
      })
      .sort((a, b) => {
        const ta = new Date(latestInteractionByLead[a.id]?.date || a.last_contacted_date);
        const tb = new Date(latestInteractionByLead[b.id]?.date || b.last_contacted_date);
        return ta - tb; // longest quiet first
      });
  }, [leads, cohort1Ids, upcomingEventLeadIds, latestInteractionByLead, now]);

  const cohort2Ids = useMemo(() => new Set(cohort2.map(l => l.id)), [cohort2]);

  // ── Cohort 3: Awaiting First Touch (neutral, collapsed by default) ──
  const cohort3 = useMemo(() => {
    return leads.filter(lead => {
      if (CLOSED_STATUSES.has(lead.status)) return false;
      if (cohort1Ids.has(lead.id) || cohort2Ids.has(lead.id)) return false;
      if (isFreshInquiry(lead)) return true; // fresh inquiries always land here
      if (upcomingEventLeadIds.has(lead.id)) return false;
      const latest = latestInteractionByLead[lead.id];
      const touchDate = latest?.date || lead.last_contacted_date;
      return !touchDate; // no touch ever
    });
  }, [leads, cohort1Ids, cohort2Ids, upcomingEventLeadIds, latestInteractionByLead, now]);

  const actionableCount = cohort1.length + cohort2.length;

  // No actionable leads + no backlog → nothing to render
  if (actionableCount === 0 && cohort3.length === 0) return null;

  const renderLeadRow = (lead, cohort) => {
    const latest = latestInteractionByLead[lead.id];
    const touchDate = latest?.date || lead.last_contacted_date;
    const touchChannel = latest?.channel || lead.outreach_channel || 'other';
    const ChannelIcon = CHANNEL_ICONS[touchChannel] || StickyNote;
    const daysSinceTouch = touchDate ? daysBetween(new Date(), touchDate) : null;

    let statusBadge = null;
    if (cohort === 1) {
      const daysOverdue = daysBetween(now, lead.next_followup_date);
      statusBadge = (
        <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">
          <Clock className="w-3 h-3 mr-1" />
          due {fmtDate(lead.next_followup_date)} — {daysOverdue}d overdue
        </Badge>
      );
    } else if (cohort === 2) {
      statusBadge = (
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
          <AlertTriangle className="w-3 h-3 mr-1" />
          last touch {daysSinceTouch}d ago
        </Badge>
      );
    } else if (isFreshInquiry(lead)) {
      statusBadge = (
        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">
          New inquiry
        </Badge>
      );
    }

    return (
      <div key={lead.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ borderColor: cohort === 1 ? '#fecaca' : cohort === 2 ? '#fde68a' : '#e5e7eb' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800">{lead.name}</p>
            {lead.company && (
              <span className="text-gray-500 text-sm">{lead.company}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {statusBadge}
            {daysSinceTouch !== null ? (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <ChannelIcon className="w-3 h-3" />
                {CHANNEL_LABELS[touchChannel] || 'Touch'} · {daysSinceTouch}d ago
              </span>
            ) : (
              cohort !== 1 && cohort !== 2 && (
                <span className="text-xs text-gray-400 italic">No contact yet</span>
              )
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
  };

  const renderMoreLink = (count) => (
    <Link to={createPageUrl('Leads')} className="inline-block">
      <span className="text-xs text-[#264d44] underline">+{count} more — view all in Leads</span>
    </Link>
  );

  // No actionable fires — small green line instead of the card
  if (actionableCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>No leads slipping — {cohort3.length} awaiting first outreach</span>
        <Link to={createPageUrl('Leads')} className="text-xs text-green-700 underline ml-auto">view in Leads</Link>
      </div>
    );
  }

  return (
    <>
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl text-gray-800">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              Leads Needing Attention
            </div>
            <Badge className="bg-orange-500 text-white">{actionableCount} need attention</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ── Cohort 1: Overdue Follow-Ups ── */}
          {cohort1.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-5 rounded-full bg-red-500" />
                <h3 className="text-sm font-semibold text-red-700">Overdue Follow-Ups</h3>
                <span className="text-xs text-gray-400">{cohort1.length}</span>
              </div>
              <div className="space-y-3">
                {cohort1.slice(0, ROW_CAP).map(lead => renderLeadRow(lead, 1))}
              </div>
              {cohort1.length > ROW_CAP && (
                <div className="mt-2">{renderMoreLink(cohort1.length - ROW_CAP)}</div>
              )}
            </div>
          )}

          {/* ── Cohort 2: Going Quiet ── */}
          {cohort2.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-5 rounded-full bg-amber-500" />
                <h3 className="text-sm font-semibold text-amber-700">Going Quiet</h3>
                <span className="text-xs text-gray-400">{cohort2.length}</span>
              </div>
              <div className="space-y-3">
                {cohort2.slice(0, ROW_CAP).map(lead => renderLeadRow(lead, 2))}
              </div>
              {cohort2.length > ROW_CAP && (
                <div className="mt-2">{renderMoreLink(cohort2.length - ROW_CAP)}</div>
              )}
            </div>
          )}

          {/* ── Cohort 3: Awaiting First Touch (collapsed backlog) ── */}
          {cohort3.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCohort3Open(o => !o)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {cohort3Open
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="w-1.5 h-5 rounded-full bg-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-600">Awaiting First Touch</h3>
                  <span className="text-xs text-gray-400">{cohort3.length}</span>
                </button>
                <Link to={createPageUrl('Leads')} className="text-xs text-gray-500 underline">
                  view in Leads
                </Link>
              </div>
              {!cohort3Open && (
                <p className="text-xs text-gray-500 mt-1.5 ml-6">
                  {cohort3.length} leads awaiting first outreach — view in Leads
                </p>
              )}
              {cohort3Open && (
                <div className="space-y-3 mt-3">
                  {cohort3.map(lead => renderLeadRow(lead, 3))}
                </div>
              )}
            </div>
          )}
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