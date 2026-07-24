import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, RefreshCw, Mail, Wand2, Check, Loader2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { TagChips } from '@/components/ui/TagChips';
import { useDraftGeneration } from '@/components/campaign/useDraftGeneration';
import CampaignRecipientList from '@/components/campaign/CampaignRecipientList';
import CampaignDraftReview from '@/components/campaign/CampaignDraftReview';

const CAMPAIGN_STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  generating: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
  archived: 'bg-gray-100 text-gray-400',
};

export default function CampaignDetailStub({ campaignId, onBack }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const { generating, progress, generate } = useDraftGeneration(campaignId);

  // Bulk approve state
  const [bulkApproving, setBulkApproving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncCalledRef = useRef(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkError, setBulkError] = useState(null);

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['outreach_campaign', campaignId],
    queryFn: () => base44.entities.OutreachCampaign.get(campaignId),
  });

  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ['campaign_recipients_detail', campaignId],
    queryFn: () => base44.entities.CampaignRecipient.filter({ campaign_id: campaignId }, '-created_date', 500),
  });

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncCampaignSendStatus', { campaign_id: campaignId });
      if (res.data?.notes) {
        toast.info(res.data.notes.join('; '));
      }
      if (res.data?.sent > 0 || res.data?.replied > 0) {
        toast.success(`${res.data.sent} sent, ${res.data.replied} replied status updated`);
      }
      queryClient.invalidateQueries({ queryKey: ['campaign_recipients_detail', campaignId] });
    } catch (e) {
      // Silent fail on auto-call
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (syncCalledRef.current || !campaignId) return;
    syncCalledRef.current = true;
    handleSyncStatus();
  }, [campaignId]);

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

  const handleBulkApprove = async () => {
    setBulkApproving(true);
    setBulkError(null);

    const drafted = recipients.filter(r => r.status === 'drafted');
    setBulkProgress({ done: 0, total: drafted.length });

    let error = null;
    for (let i = 0; i < drafted.length; i++) {
      const r = drafted[i];
      try {
        const res = await base44.functions.invoke('approveCampaignDraft', { recipient_id: r.id });
        if (res.data?.error) throw new Error(res.data.error);
        setBulkProgress({ done: i + 1, total: drafted.length });
        queryClient.invalidateQueries({ queryKey: ['campaign_recipients_detail', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['outreach_campaign', campaignId] });
      } catch (e) {
        error = `${r.name || r.email}: ${e?.data?.error || e.message}`;
        setBulkError(error);
        break;
      }
    }

    setBulkApproving(false);
    if (error) {
      toast.error(`Stopped: ${error}`);
    } else {
      toast.success(`Approved ${drafted.length} drafts — Gmail drafts created`);
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
  const draftedRecipients = recipients.filter(r => r.status === 'drafted');
  const draftedCount = draftedRecipients.length;
  const buttonLabel = draftedCount > 0 ? 'Resume generating' : 'Generate drafts';

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="w-9 h-9" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{campaign?.name}</h1>
              <Badge className={`text-xs border-0 ${CAMPAIGN_STATUS_STYLES[campaign?.status] || 'bg-gray-100'}`}>
                {campaign?.status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">
              {campaign?.audience_type?.replace('_', ' ')}s - {activeRecipients.length} recipients
              {skippedRecipients.length > 0 && ` (${skippedRecipients.length} skipped)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleSyncStatus}
            disabled={syncing || generating || bulkApproving}
            className="gap-1.5 text-sm"
          >
            <Activity className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Refresh status
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || generating || bulkApproving || syncing}
            className="gap-1.5 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Audience
          </Button>
          {eligibleRecipients.length > 0 && (
            <Button
              onClick={() => generate(recipients)}
              disabled={generating || bulkApproving}
              className="bg-[#264d44] hover:bg-[#264d44]/90 text-white gap-1.5 text-sm"
            >
              <Wand2 className="w-4 h-4" />
              {buttonLabel}
            </Button>
          )}
          {draftedCount > 0 && !bulkApproving && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={generating || bulkApproving}
                  className="gap-1.5 text-sm border-[#264d44] text-[#264d44] hover:bg-[#264d44]/5"
                >
                  <Check className="w-4 h-4" />
                  Approve all drafted ({draftedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve {draftedCount} drafted emails?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This creates Gmail drafts for all {draftedCount} recipients with "drafted" status. No emails are sent — they wait in the sender's Gmail Drafts for manual sending. Processing is sequential and stops on the first error.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkApprove}>
                    Approve {draftedCount}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Generation progress */}
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

      {/* Bulk approve progress */}
      {bulkApproving && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Approving {bulkProgress.done} of {bulkProgress.total}...
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#264d44] h-2 rounded-full transition-all"
              style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Bulk error */}
      {bulkError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          Stopped at: {bulkError}
        </div>
      )}

      {/* Tags / Scope */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {campaign?.audience_scope === 'all' ? (
          <span className="inline-block text-xs font-medium text-[#264d44] bg-[#264d44]/10 rounded-full px-2.5 py-0.5 capitalize">
            All {campaign?.audience_type === 'partner' ? 'partners' : 'clients'}
          </span>
        ) : campaign?.tag_ids && campaign.tag_ids.length > 0 ? (
          <TagChips tags={campaign.tag_ids} />
        ) : null}
        {campaign?.exclude_tag_ids && campaign.exclude_tag_ids.length > 0 && (
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

      {/* Two-panel review queue */}
      {recipientsLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading recipients...</div>
      ) : recipients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No recipients yet. Click "Refresh Audience" to build the list.</p>
        </div>
      ) : (
        <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 340px)' }}>
          {/* Left panel — recipient list */}
          <div className={`${selectedRecipientId ? 'hidden lg:block' : 'block'} w-full lg:w-[38%] shrink-0`}>
            <CampaignRecipientList
              recipients={recipients}
              selectedId={selectedRecipientId}
              onSelect={setSelectedRecipientId}
            />
          </div>

          {/* Right panel — draft review */}
          <div className={`${selectedRecipientId ? 'block' : 'hidden lg:block'} w-full lg:flex-1`}>
            {selectedRecipient ? (
              <CampaignDraftReview
                recipient={selectedRecipient}
                campaign={campaign}
                onBack={() => setSelectedRecipientId(null)}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center h-full flex items-center justify-center">
                <p className="text-gray-400 text-sm">Select a recipient to review their draft.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}