import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import OutreachCampaignCard from '@/components/campaign/OutreachCampaignCard';
import NewCampaignWizard from '@/components/campaign/NewCampaignWizard';
import CampaignDetailStub from '@/components/campaign/CampaignDetailStub';

export default function OutreachCampaignsTab() {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['outreach_campaigns'],
    queryFn: () => base44.entities.OutreachCampaign.list('-created_date'),
  });

  // Auto-sync send/reply status for active campaigns on mount (cap 5, sequential).
  const syncRunRef = useRef(false);
  useEffect(() => {
    if (syncRunRef.current || isLoading || campaigns.length === 0) return;
    syncRunRef.current = true;
    (async () => {
      const active = campaigns.filter(c => c.status === 'active').slice(0, 5);
      for (const c of active) {
        try {
          await base44.functions.invoke('syncCampaignSendStatus', { campaign_id: c.id });
        } catch (e) {
          toast.error(`Couldn't refresh send status for ${c.name}`);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['campaign_recipients'] });
      queryClient.invalidateQueries({ queryKey: ['outreach_campaigns'] });
    })();
  }, [campaigns, isLoading]);

  const archiveMutation = useMutation({
    mutationFn: (id) => base44.entities.OutreachCampaign.update(id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach_campaigns'] });
      toast.success('Campaign archived');
    },
  });

  if (selectedCampaignId) {
    return (
      <CampaignDetailStub
        campaignId={selectedCampaignId}
        onBack={() => setSelectedCampaignId(null)}
      />
    );
  }

  const activeCampaigns = campaigns.filter(c => c.status !== 'archived');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#264d44] flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Outreach Campaigns</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Tag-based email campaigns with Maya-drafted personalization</p>
          </div>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="bg-[#264d44] hover:bg-[#264d44]/90 text-white gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span> Outreach Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading campaigns...</div>
      ) : activeCampaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No outreach campaigns yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {activeCampaigns.map(c => (
            <OutreachCampaignCard
              key={c.id}
              campaign={c}
              onClick={() => setSelectedCampaignId(c.id)}
              onArchive={() => archiveMutation.mutate(c.id)}
            />
          ))}
        </div>
      )}

      <NewCampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(id) => { setWizardOpen(false); setSelectedCampaignId(id); }}
      />
    </div>
  );
}