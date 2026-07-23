import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export function useDraftGeneration(campaignId) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const cancelRef = useRef(false);
  const generatingRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    return () => { cancelRef.current = true; };
  }, []);

  const generate = useCallback(async (recipients) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);

    const eligible = recipients.filter(r =>
      r.status === 'pending' || r.status === 'error' || r.status === 'drafting'
    );

    if (eligible.length === 0) {
      generatingRef.current = false;
      setGenerating(false);
      return;
    }

    // Set campaign status to "generating"
    try {
      await base44.entities.OutreachCampaign.update(campaignId, { status: 'generating' });
      queryClient.invalidateQueries({ queryKey: ['outreach_campaign', campaignId] });
    } catch (e) { /* non-fatal */ }

    setProgress({ done: 0, total: eligible.length, failed: 0 });
    let done = 0;
    let failed = 0;

    const queue = [...eligible];

    const processOne = async (recipient) => {
      if (cancelRef.current) return;
      try {
        await base44.functions.invoke('generateCampaignDraft', {
          campaign_id: campaignId,
          recipient_id: recipient.id,
        });
        done++;
      } catch (e) {
        if (cancelRef.current) return;
        // One automatic retry
        try {
          await base44.functions.invoke('generateCampaignDraft', {
            campaign_id: campaignId,
            recipient_id: recipient.id,
          });
          done++;
        } catch (e2) {
          failed++;
        }
      }
      setProgress({ done, total: eligible.length, failed });
      queryClient.invalidateQueries({ queryKey: ['campaign_recipients_detail', campaignId] });
    };

    // Concurrency pool of 3
    const concurrency = Math.min(3, queue.length);
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (queue.length > 0 && !cancelRef.current) {
          const recipient = queue.shift();
          if (recipient) await processOne(recipient);
        }
      })());
    }
    await Promise.all(workers);

    // Set campaign status to "in_review"
    if (!cancelRef.current) {
      try {
        await base44.entities.OutreachCampaign.update(campaignId, { status: 'in_review' });
        queryClient.invalidateQueries({ queryKey: ['outreach_campaign', campaignId] });
      } catch (e) { /* non-fatal */ }
      queryClient.invalidateQueries({ queryKey: ['campaign_recipients_detail', campaignId] });
      toast.success(`Drafts generated: ${done} of ${eligible.length}${failed > 0 ? ` (${failed} failed)` : ''}`);
    }

    generatingRef.current = false;
    setGenerating(false);
  }, [campaignId, queryClient]);

  return { generating, progress, generate };
}