import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TagChips } from '@/components/ui/TagChips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Archive, ChevronRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  generating: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
  archived: 'bg-gray-100 text-gray-400',
};

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

      {campaign.tag_ids && campaign.tag_ids.length > 0 && (
        <div className="mb-2">
          <TagChips tags={campaign.tag_ids} />
        </div>
      )}

      {counts.total > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-600 font-medium">{counts.total}</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-amber-600 font-medium">{counts.drafted}</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-green-600 font-medium">{counts.approved}</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-purple-600 font-medium">{counts.sent}</span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-teal-600 font-medium">{counts.replied}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      )}
    </div>
  );
}