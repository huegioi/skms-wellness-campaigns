import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Mail, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { TagChips } from '@/components/ui/TagChips';
import { useDraftGeneration } from '@/components/campaign/useDraftGeneration';

const RECIPIENT_STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  drafting: 'bg-blue-100 text-blue-700',
  drafted: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  sent: 'bg-purple-100 text-purple-700',
  replied: 'bg-teal-100 text-teal-700',
  skipped: 'bg-gray-100 text-gray-400',
  error: 'bg-red-100 text-red-700',
};

export default function CampaignDetailStub({ campaignId, onBack }) {
  const [refreshing, setRefreshing] = useState(false);
  const { generating, progress, generate } = useDraftGeneration(campaignId);

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['outreach_campaign', campaignId],
    queryFn: () => base44.entities.OutreachCampaign.get(campaignId),
  });

  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ['campaign_recipients_detail', campaignId],
    queryFn: () => base44.entities.CampaignRecipient.filter({ campaign_id: campaignId }, '-created_date', 500),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke('buildCampaignAudience', {
        campaign_id: campaignId,
      });
      toast.success(`Audience refreshed - ${res.data.created} new, ${res.data.skipped} skipped`);
    } catch (e) {
      toast.error(e?.data?.error || 'Failed to refresh audience');
    } finally {
      setRefreshing(false);
    }
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#264d44] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeRecipients = recipients.filter(r => r.status !== 'skipped');
  const skippedRecipients = recipients.filter(r => r.status === 'skipped');

  const eligibleRecipients = recipients.filter(r =>
    r.status === 'pending' || r.status === 'error' || r.status === 'drafting'
  );
  const draftedCount = recipients.filter(r => r.status === 'drafted').length;
  const buttonLabel = draftedCount > 0 ? 'Resume generating' : 'Generate drafts';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="w-9 h-9" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{campaign?.name}</h1>
              <Badge className={`text-xs border-0 ${RECIPIENT_STATUS_STYLES[campaign?.status] || 'bg-gray-100'}`}>
                {campaign?.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">
              {campaign?.audience_type?.replace('_', ' ')}s - {activeRecipients.length} recipients
              {skippedRecipients.length > 0 && ` (${skippedRecipients.length} skipped)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || generating}
            className="gap-1.5 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Audience
          </Button>
          {eligibleRecipients.length > 0 && (
            <Button
              onClick={() => generate(recipients)}
              disabled={generating}
              className="bg-[#264d44] hover:bg-[#264d44]/90 text-white gap-1.5 text-sm"
            >
              <Wand2 className="w-4 h-4" />
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {generating && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">
              {progress.done} of {progress.total} drafted
              {progress.failed > 0 && ` (${progress.failed} failed)`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#264d44] h-2 rounded-full transition-all"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {campaign?.tag_ids && campaign.tag_ids.length > 0 && (
        <div className="mb-4">
          <TagChips tags={campaign.tag_ids} />
        </div>
      )}

      {/* Recipient list */}
      {recipientsLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading recipients...</div>
      ) : recipients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No recipients yet. Click "Refresh Audience" to build the list.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Owner</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {r.name || '(no name)'}
                    {r.error_message && (
                      <span className="block text-xs text-red-500">{r.error_message}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{r.email || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell">{r.company || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">{r.owner || '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.thin_context && (
                        <Badge className="text-xs border-0 bg-orange-100 text-orange-700">thin</Badge>
                      )}
                      <Badge className={`text-xs border-0 ${RECIPIENT_STATUS_STYLES[r.status] || 'bg-gray-100'}`}>
                        {r.status}
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}