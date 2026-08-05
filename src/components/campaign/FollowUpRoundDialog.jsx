import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CtaLibrarySection from '@/components/campaign/wizard/CtaLibrarySection';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Launch a follow-up "bump" round for an Outreach Campaign.
 *
 * Calls launchCampaignFollowUpRound (preview → live eligible count; launch →
 * creates pending bump recipient rows). The CTA selector defaults to the
 * campaign's original selected_ctas and is editable via the same
 * CtaLibrarySection used in the campaign wizard.
 *
 * Like all campaign email, follow-ups are DRAFTS ONLY — launching queues
 * pending rows that flow through generate → review → approve(=Gmail draft).
 */
export default function FollowUpRoundDialog({ campaign, onClose, onLaunched }) {
  const [waitDays, setWaitDays] = useState(3);
  const [guidance, setGuidance] = useState('');
  const [selectedCtas, setSelectedCtas] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [launching, setLaunching] = useState(false);

  const fetchPreview = useCallback(async () => {
    setPreviewing(true);
    try {
      const res = await base44.functions.invoke('launchCampaignFollowUpRound', {
        campaign_id: campaign.id,
        wait_days: Number(waitDays) || 3,
        preview: true,
      });
      setPreview(res.data);
    } catch (e) {
      setPreview({ eligible_count: 0, sample: [], error: e?.data?.error || 'Failed to check eligibility' });
    } finally {
      setPreviewing(false);
    }
  }, [campaign.id, waitDays]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await base44.functions.invoke('launchCampaignFollowUpRound', {
        campaign_id: campaign.id,
        guidance,
        selected_ctas: selectedCtas,
        wait_days: Number(waitDays) || 3,
        preview: false,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`Follow-up round launched — ${res.data.created} recipient${res.data.created !== 1 ? 's' : ''} queued for drafting`);
      onLaunched?.(res.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.data?.error || e.message || 'Failed to launch follow-up round');
    } finally {
      setLaunching(false);
    }
  };

  const eligibleCount = preview?.eligible_count ?? 0;
  const canLaunch = eligibleCount > 0 && !launching;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !launching) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Launch Follow-Up Round</DialogTitle>
          <DialogDescription>
            Bump recipients whose previous campaign email was sent but never answered. New rows are drafted and reviewed exactly like round 1 — no email is sent automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Eligibility */}
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            {previewing ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking eligibility…
              </p>
            ) : preview?.error ? (
              <p className="text-sm text-red-500">{preview.error}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800">
                  {eligibleCount} recipient{eligibleCount !== 1 ? 's' : ''} eligible to bump
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sent, unreplied, and ≥ {waitDays} day{Number(waitDays) !== 1 ? 's' : ''} since last touch (max 3 follow-ups).
                </p>
                {preview?.sample?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sample</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {preview.sample.map((n, i) => (
                        <li key={i}>• {n}</li>
                      ))}
                    </ul>
                    {eligibleCount > preview.sample.length && (
                      <p className="text-xs text-gray-400 mt-1">and {eligibleCount - preview.sample.length} more</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Wait days */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Wait days (min days since last send)</Label>
            <Input
              type="number"
              min={1}
              value={waitDays}
              onChange={(e) => setWaitDays(e.target.value)}
              className="mt-1 h-9"
            />
          </div>

          {/* Guidance */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Guidance for Maya (optional)</Label>
            <Textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. add a relevant resource, keep it to one question"
              className="mt-1"
              rows={3}
            />
          </div>

          {/* CTAs — defaults to the campaign's original selected_ctas, editable */}
          <CtaLibrarySection
            initialCtas={campaign.selected_ctas || []}
            onSelectedCtasChange={setSelectedCtas}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={launching}>Cancel</Button>
          <Button
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="bg-[#770142] hover:bg-[#770142]/90 text-white gap-1.5"
          >
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Launch ({eligibleCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}