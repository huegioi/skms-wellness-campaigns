import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineText } from '@/components/shared/inline/InlineText';
import { Check, SkipForward, RefreshCw, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import CampaignContextPanel from './CampaignContextPanel';

const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  drafting: 'bg-blue-100 text-blue-700',
  drafted: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  sent: 'bg-purple-100 text-purple-700',
  replied: 'bg-teal-100 text-teal-700',
  skipped: 'bg-gray-100 text-gray-400',
  error: 'bg-red-100 text-red-700',
};

export default function CampaignDraftReview({ recipient, campaign, onBack }) {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Resolve sender
  const sender = campaign?.sender_mode === 'heather' ? 'heather'
    : campaign?.sender_mode === 'william' ? 'william'
    : (recipient.owner || '').toLowerCase().includes('heather') ? 'heather' : 'william';
  const senderEmail = sender === 'heather' ? 'heather@skillfulmeans.life' : 'william@skillfulmeans.life';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['campaign_recipients_detail', recipient.campaign_id] });
    queryClient.invalidateQueries({ queryKey: ['outreach_campaign', recipient.campaign_id] });
  };

  const saveField = async (field, value) => {
    try {
      await base44.entities.CampaignRecipient.update(recipient.id, { [field]: value });
      invalidate();
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await base44.functions.invoke('approveCampaignDraft', { recipient_id: recipient.id });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Draft approved — Gmail draft created');
      invalidate();
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Failed to approve');
      invalidate();
    } finally {
      setApproving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await base44.functions.invoke('generateCampaignDraft', {
        campaign_id: recipient.campaign_id,
        recipient_id: recipient.id,
        feedback: feedback || undefined,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Draft regenerated');
      setFeedback('');
      invalidate();
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSkip = async () => {
    try {
      await base44.entities.CampaignRecipient.update(recipient.id, { status: 'skipped' });
      invalidate();
    } catch (e) {
      toast.error('Failed to skip');
    }
  };

  const ccString = (recipient.cc_emails || []).join(', ');
  const hasDraft = recipient.draft_subject || recipient.draft_body;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Mobile back button */}
      <div className="lg:hidden p-3 border-b border-gray-100">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to list
        </Button>
      </div>

      {/* Header: status + From / To / CC */}
      <div className="p-4 border-b border-gray-100 space-y-1.5">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={`text-xs border-0 ${STATUS_STYLES[recipient.status] || 'bg-gray-100'}`}>
            {recipient.status}
          </Badge>
          {recipient.thin_context && (
            <Badge className="text-xs border-0 bg-orange-100 text-orange-700">thin context</Badge>
          )}
          {recipient.approved_at && (
            <span className="text-xs text-gray-400">
              Approved {new Date(recipient.approved_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-gray-400 w-12 shrink-0">From</span>
          <span className="text-sm text-gray-700">{senderEmail}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-gray-400 w-12 shrink-0">To</span>
          <span className="text-sm text-gray-700 truncate">{recipient.email || '-'}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-gray-400 w-12 shrink-0">CC</span>
          <div className="flex-1 min-w-0">
            <InlineText
              value={ccString}
              placeholder="Add CC emails (comma-separated)"
              onSave={(v) => saveField('cc_emails', v ? v.split(',').map(e => e.trim()).filter(Boolean) : [])}
              className="text-sm text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {recipient.error_message && recipient.status !== 'approved' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span className="text-xs text-red-600">{recipient.error_message}</span>
        </div>
      )}

      {/* Draft body */}
      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        {!hasDraft && recipient.status !== 'drafting' && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No draft yet. Generate drafts to create one.
          </div>
        )}
        {recipient.status === 'drafting' && (
          <div className="text-center py-8 text-blue-500 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Draft is being generated...
          </div>
        )}
        {hasDraft && (
          <>
            <div>
              <InlineText
                label="Subject"
                value={recipient.draft_subject || ''}
                placeholder="Draft subject..."
                onSave={(v) => saveField('draft_subject', v)}
                className="text-sm font-medium text-gray-900"
              />
            </div>
            <div>
              <InlineText
                label="Body"
                value={recipient.draft_body || ''}
                placeholder="Draft body..."
                onSave={(v) => saveField('draft_body', v)}
                multiline
                className="text-sm text-gray-700"
              />
            </div>
            <CampaignContextPanel recipient={recipient} />
          </>
        )}
      </div>

      {/* Regenerate feedback */}
      {hasDraft && recipient.status !== 'approved' && (
        <div className="border-t border-gray-100 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Tell Maya what to fix..."
              className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 outline-none focus:border-[#264d44]"
              onKeyDown={e => { if (e.key === 'Enter' && !regenerating) handleRegenerate(); }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="gap-1.5 shrink-0"
            >
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="border-t border-gray-100 p-3 flex items-center gap-2">
        <Button
          onClick={handleApprove}
          disabled={approving || regenerating || recipient.status === 'approved' || !hasDraft}
          className="bg-[#264d44] hover:bg-[#264d44]/90 text-white gap-1.5 text-sm flex-1"
        >
          {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {recipient.status === 'approved' ? 'Approved' : 'Approve'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={recipient.status === 'skipped' || approving || regenerating}
          className="gap-1.5 text-sm text-gray-500"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </Button>
      </div>
    </div>
  );
}