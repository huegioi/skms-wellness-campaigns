import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, CheckCircle2, SkipForward, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const TYPE_LABELS = {
  enps_post_session: 'Post-Session eNPS',
  post_session_pulse: 'Post-Session Pulse',
  cohort_end: 'Cohort End',
  cohort_1mo: '30-Day Follow-Up',
  journey_organizer_reminder: 'Journey Organizer Reminder',
};

const STATUS_CONFIG = {
  pending: { label: 'Queued', icon: Clock, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  sent: { label: 'Sent', icon: CheckCircle2, className: 'bg-green-50 text-green-700 border-green-200' },
  skipped: { label: 'Skipped', icon: SkipForward, className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function SurveySendsCard({ clientId, eventId }) {
  const [manuallyToggled, setManuallyToggled] = useState(null); // null = follow auto behavior

  const { data: sends, isLoading } = useQuery({
    queryKey: ['survey-sends', clientId, eventId],
    queryFn: async () => {
      const filter = {};
      if (clientId) filter.client_id = clientId;
      if (eventId) filter.event_id = eventId;
      const res = await base44.entities.ScheduledSurveySend.filter(filter, '-send_at', 20);
      return res.filter(s => !s.is_demo);
    },
  });

  const summary = useMemo(() => {
    if (!sends || sends.length === 0) return null;
    const now = new Date();
    const pending = sends.filter(s => s.status === 'pending');
    const overdue = pending.filter(s => new Date(s.send_at) < now);
    const errors = sends.filter(s => !!s.error_message);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sentThisWeek = sends.filter(s => s.status === 'sent' && s.sent_at && new Date(s.sent_at) >= weekAgo);
    return { pending: pending.length, overdue: overdue.length, errors: errors.length, sentThisWeek: sentThisWeek.length };
  }, [sends]);

  if (isLoading) return null;
  if (!sends || sends.length === 0) return null;

  // Auto-expand when something needs attention (an error or an overdue queued send);
  // otherwise collapsed. A manual click overrides either way.
  const needsAttention = summary.errors > 0 || summary.overdue > 0;
  const expanded = manuallyToggled !== null ? manuallyToggled : needsAttention;

  const summaryParts = [];
  if (summary.pending > 0) summaryParts.push(`${summary.pending} queued`);
  if (summary.sentThisWeek > 0) summaryParts.push(`${summary.sentThisWeek} sent this week`);
  if (summary.errors > 0) summaryParts.push(`${summary.errors} error${summary.errors !== 1 ? 's' : ''}`);
  if (summaryParts.length === 0) summaryParts.push(`${sends.length} recent`);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setManuallyToggled(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-4 h-4 shrink-0 text-[#264d44]" />
          <span className="text-sm font-bold text-gray-700">Survey Sends</span>
          <span className="text-xs text-gray-500 truncate">{summaryParts.join(' · ')}</span>
          {needsAttention ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />}
      </button>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {sends.map(send => {
            const cfg = STATUS_CONFIG[send.status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const sendDate = new Date(send.send_at);
            const isOverdue = send.status === 'pending' && sendDate < new Date();

            return (
              <div key={send.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${send.status === 'sent' ? 'text-green-500' : send.status === 'skipped' ? 'text-amber-500' : isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{TYPE_LABELS[send.send_type] || send.send_type}</p>
                    <p className="text-xs text-gray-500">
                      {sendDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {send.recipient_count > 0 && ` · ${send.recipient_count} recipient${send.recipient_count !== 1 ? 's' : ''}`}
                    </p>
                    {send.skip_reason && (
                      <p className="text-xs text-amber-600 mt-0.5">⚠ {send.skip_reason}</p>
                    )}
                    {send.error_message && (
                      <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {send.error_message}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${cfg.className}`}>
                  {cfg.label}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
