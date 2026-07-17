import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, CheckCircle2, SkipForward, AlertCircle } from 'lucide-react';

const TYPE_LABELS = {
  enps_post_session: 'Post-Session eNPS',
  cohort_end: 'Cohort End',
  cohort_1mo: '30-Day Follow-Up',
};

const STATUS_CONFIG = {
  pending: { label: 'Queued', icon: Clock, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  sent: { label: 'Sent', icon: CheckCircle2, className: 'bg-green-50 text-green-700 border-green-200' },
  skipped: { label: 'Skipped', icon: SkipForward, className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function SurveySendsCard({ clientId, eventId }) {
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

  if (isLoading) return null;
  if (!sends || sends.length === 0) return null;

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-700">
          <Mail className="w-4 h-4 text-[#264d44]" />
          Survey Sends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
    </Card>
  );
}