import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TagChips } from '@/components/ui/TagChips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Archive, ChevronRight, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  generating: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
  archived: 'bg-gray-100 text-gray-400',
};

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OutreachCampaignCard({ campaign, onClick, onArchive }) {
  const queryClient = useQueryClient();
  const { data: recipients = [] } = useQuery({
    queryKey: ['campaign_recipients', campaign.id],
    queryFn: () => base44.entities.CampaignRecipient.filter({ campaign_id: campaign.id }, '-created_date', 500),
  });

  const counts = {
    total: recipients.length,
    drafted: recipients.filter(r => r.status === 'drafted').length,
    approved: recipients.filter(r => r.status === 'approved').length,
    sent: recipients.filter(r => r.status === 'sent').length,
    replied: recipients.filter(r => r.status === 'replied').length,
  };

  // Approved-but-unsent drafts need manual sending — surface which mailbox they live in.
  const approvedUnsent = recipients.filter(r => r.status === 'approved');
  const mailboxGroups = {};
  for (const r of approvedUnsent) {
    if (r.draft_mailbox) {
      mailboxGroups[r.draft_mailbox] = (mailboxGroups[r.draft_mailbox] || 0) + 1;
    }
  }
  const mailboxKeys = Object.keys(mailboxGroups);
  const syncRelative = relativeTime(campaign.last_status_sync_at);

  const handleMarkCompleted = async (e) => {
    e?.stopPropagation();
    try {
      await base44.entities.OutreachCampaign.update(campaign.id, { status: 'completed' });
      queryClient.invalidateQueries({ queryKey: ['outreach_campaigns'] });
      toast.success('Campaign marked as completed');
    } catch (err) {
      toast.error('Failed to mark completed');
    }
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-snug">{campaign.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {campaign.audience_type?.replace('_', ' ')}s - {recipients.length} recipients
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={`text-xs font-medium border-0 ${STATUS_STYLES[campaign.status] || 'bg-gray-100 text-gray-600'}`}>
            {campaign.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="w-7 h-7 text-gray-400 hover:text-gray-700"
                onClick={e => e.stopPropagation()}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem onClick={handleMarkCompleted}>
                <CheckCircle className="w-3.5 h-3.5 mr-2" /> Mark completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="w-3.5 h-3.5 mr-2" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1">
        {campaign.audience_scope === 'all' ? (
          <span className="inline-block text-xs font-medium text-[#264d44] bg-[#264d44]/10 rounded-full px-2.5 py-0.5 capitalize">
            All {campaign.audience_type === 'partner' ? 'partners' : 'clients'}
          </span>
        ) : campaign.tag_ids && campaign.tag_ids.length > 0 ? (
          <TagChips tags={campaign.tag_ids} />
        ) : null}
        {campaign.exclude_tag_ids && campaign.exclude_tag_ids.length > 0 && (
          <span className="inline-flex items-center gap-0.5">
            {campaign.exclude_tag_ids.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-gray-400 line-through"
              >
                <span className="text-gray-300 no-underline">-</span>{tag}
              </span>
            ))}
          </span>
        )}
      </div>

      {campaign.selected_ctas && campaign.selected_ctas.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">CTAs:</span>
          {campaign.selected_ctas.map((cta, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium text-[#770142] bg-[#770142]/10 rounded-full px-2 py-0.5">
              {cta.label}
            </span>
          ))}
        </div>
      )}

      {counts.total > 0 && (
        <div className="flex items-center justify-between">
          <div
            className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs"
            title="Campaign progress: recipients → drafted → approved → sent → replied"
          >
            <span className="text-gray-600 font-medium">{counts.total} recipients</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-amber-600 font-medium">{counts.drafted} drafted</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-green-600 font-medium">{counts.approved} approved</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-purple-600 font-medium">{counts.sent} sent</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-teal-600 font-medium">{counts.replied} replied</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </div>
      )}

      {approvedUnsent.length > 0 && (
        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {mailboxKeys.length > 0 ? (
              <>
                <span className="font-semibold">{approvedUnsent.length} drafts awaiting send</span> in{' '}
                {mailboxKeys.map((mb, i) => (
                  <span key={mb}>
                    {i > 0 && ', '}
                    <span className="font-semibold">{mb}</span>
                    {mailboxKeys.length > 1 ? ` (${mailboxGroups[mb]})` : ''}
                  </span>
                ))}
              </>
            ) : (
              <>{approvedUnsent.length} drafts awaiting send in the sender's Gmail — open campaign to sync</>
            )}
          </span>
        </div>
      )}

      {syncRelative && (
        <div className="mt-1.5 text-[11px] text-gray-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Status checked {syncRelative}
        </div>
      )}
    </div>
  );
}