import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical, Sprout, Trash2, Link2, ClipboardList, Lock, Loader2, QrCode, Brain, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DemoStatusBanner from '@/components/demo/DemoStatusBanner';
import DemoInventoryTable from '@/components/demo/DemoInventoryTable';
import DemoLinkCard from '@/components/demo/DemoLinkCard';
import PurgeConfirmDialog from '@/components/demo/PurgeConfirmDialog';
import { fetchDemoCounts, fetchPortalLinks } from '@/components/demo/demoQueries';
import CheckinQrDialog from '@/components/shared/CheckinQrDialog';

const BOOTH_URL = 'https://app.skillfulmeans.life/MentalFitnessScore';

export default function Demo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [boothQrOpen, setBoothQrOpen] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(user => { setIsAdmin(user?.role === 'admin'); setAuthChecked(true); })
      .catch(() => { setAuthChecked(true); setIsAdmin(false); });
  }, []);

  const { data: counts, isLoading } = useQuery({
    queryKey: ['demoCounts'],
    queryFn: fetchDemoCounts,
    enabled: isAdmin,
  });
  const { data: portalLinks } = useQuery({
    queryKey: ['demoPortalLinks'],
    queryFn: fetchPortalLinks,
    enabled: isAdmin,
  });

  const hasDemo = counts && counts.total > 0;

  const handleSeed = async () => {
    setIsSeeding(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('seedDemoData', {});
      const data = res.data;
      toast({
        title: 'Demo data seeded',
        description: `${data.counts.clients} clients, ${data.counts.referral_partners} partner, ${data.counts.calendar_events} events, ${data.counts.feedback_responses} feedback, ${data.counts.mfs_assessments || 0} MFS assessment${data.counts.mfs_assessments === 1 ? '' : 's'}.`,
      });
      setLastResult({ type: 'seed', counts: data.counts });
      queryClient.invalidateQueries({ queryKey: ['demoCounts'] });
      queryClient.invalidateQueries({ queryKey: ['demoPortalLinks'] });
    } catch (error) {
      toast({ title: 'Seed failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const res = await base44.functions.invoke('purgeDemoData', {});
      const data = res.data;
      const total = Object.values(data.deleted).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      toast({ title: 'Demo data purged', description: `${total} records deleted across all entities.` });
      setLastResult({ type: 'purge', counts: data.deleted, total });
      setPurgeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['demoCounts'] });
      queryClient.invalidateQueries({ queryKey: ['demoPortalLinks'] });
    } catch (error) {
      toast({ title: 'Purge failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsPurging(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 font-medium">Admin access required</p>
          <p className="text-gray-400 text-sm mt-1">The demo environment is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-6 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <FlaskConical className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#013f7c' }}>Demo Environment</h1>
              <p className="text-sm text-gray-500">Admin controls for the broker-demo sandbox</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSeed} disabled={hasDemo || isSeeding} className="bg-[#264d44] hover:bg-[#1a3830]">
              {isSeeding
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Seeding...</>
                : <><Sprout className="w-4 h-4 mr-2" /> Seed demo data</>}
            </Button>
            <Button onClick={() => setPurgeOpen(true)} disabled={!hasDemo || isPurging} variant="destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Purge demo data
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <DemoStatusBanner counts={counts} isLoading={isLoading} />

        {lastResult && (
          <div className={`rounded-xl p-4 ${lastResult.type === 'seed' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            <p className="font-semibold text-sm">
              {lastResult.type === 'seed' ? '✓ Seed complete — ' : '✓ Purge complete — '}
              {Object.entries(lastResult.counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
          </div>
        )}

        {hasDemo && (
          <>
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#264d44' }}>
                <ClipboardList className="w-5 h-5" /> Demo Inventory
              </h2>
              <DemoInventoryTable counts={counts} />
            </div>

            {portalLinks && (portalLinks.brokerLink || portalLinks.clientLinks.length > 0) && (
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#264d44' }}>
                  <Link2 className="w-5 h-5" /> Demo Portal Links
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portalLinks.brokerLink && <DemoLinkCard {...portalLinks.brokerLink} />}
                  {portalLinks.clientLinks.map((link, i) => <DemoLinkCard key={i} {...link} />)}
                </div>
              </div>
            )}

            {portalLinks && portalLinks.mfsLinks && portalLinks.mfsLinks.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#264d44' }}>
                  <Brain className="w-5 h-5" /> Mental Fitness Score Links
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portalLinks.mfsLinks.map((mfs, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-purple-50">
                            <Brain className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{mfs.company}</p>
                            <p className="text-sm text-gray-500 truncate">{mfs.name}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{mfs.description}</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 shrink-0">Survey</span>
                            <input readOnly value={mfs.surveyUrl} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 font-mono truncate" />
                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(mfs.surveyUrl); toast({ title: 'Copied' }); }}><Copy className="w-3 h-3" /></Button>
                            <Button size="sm" asChild><a href={mfs.surveyUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a></Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16 shrink-0">Results</span>
                            <input readOnly value={mfs.resultsUrl} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 font-mono truncate" />
                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(mfs.resultsUrl); toast({ title: 'Copied' }); }}><Copy className="w-3 h-3" /></Button>
                            <Button size="sm" asChild><a href={mfs.resultsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#264d44' }}>
                <QrCode className="w-5 h-5" /> Booth QR
              </h2>
              <Card>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Mental Fitness Score — Booth QR</p>
                    <p className="text-sm text-gray-500">Print a large QR for conference booths. Scans to the public assessment intake page.</p>
                  </div>
                  <Button variant="outline" onClick={() => setBoothQrOpen(true)} className="gap-1.5 shrink-0">
                    <QrCode className="w-4 h-4" /> Generate QR
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <PurgeConfirmDialog open={purgeOpen} onOpenChange={setPurgeOpen} onConfirm={handlePurge} isPurging={isPurging} />

      <CheckinQrDialog
        open={boothQrOpen}
        onOpenChange={setBoothQrOpen}
        checkinUrl={BOOTH_URL}
        eventTitle="The Mental Fitness Score"
        subtitle="Scan to start a free team assessment"
      />
    </div>
  );
}