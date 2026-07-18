import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Copy, Wand2, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import MfsScoreDial from '@/components/mfs/MfsScoreDial';
import MfsScoreBars from '@/components/mfs/MfsScoreBars';
import CheckinQrDialog from '@/components/shared/CheckinQrDialog';

const BOOTH_URL = 'https://app.skillfulmeans.life/MentalFitnessScore';

export default function MfsAdminCard({ client }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boothQrOpen, setBoothQrOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const assessments = await base44.entities.MfsAssessment.filter({ client_id: client.id }, '-created_date', 1);
      if (!assessments || assessments.length === 0) { setData(null); return; }
      const res = await base44.functions.invoke('getMfsResults', { token: assessments[0].token });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [client.id]);

  const copyLink = (path, label) => {
    const url = `${window.location.origin}${path}?t=${data?.assessment?.token}`;
    navigator.clipboard.writeText(url);
    toast.success(`${label} copied!`);
  };

  if (loading) {
    return (
      <Card className="border-purple-100">
        <CardContent className="p-5 text-center text-sm text-gray-400">Loading MFS data…</CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { response_count, locked, composite, instruments, min_responses } = data;

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Mental Fitness Score
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchData} className="h-7 px-2">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-700">{response_count} response{response_count !== 1 ? 's' : ''}</span>
          {locked && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Locked — needs {min_responses}</span>}
        </div>

        {!locked && composite != null && (
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <MfsScoreDial score={composite} size={120} />
            <div className="flex-1 w-full">
              <MfsScoreBars instruments={instruments} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-100">
          <Button size="sm" variant="outline" onClick={() => copyLink('/MfsSurvey', 'Employee survey link')} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Survey link
          </Button>
          <Button size="sm" variant="outline" onClick={() => copyLink('/MfsResults', 'Results dashboard link')} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Results link
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBoothQrOpen(true)} className="gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> Booth QR
          </Button>
          <Link to="/CurriculumDesigner">
            <Button size="sm" className="bg-[#013f7c] hover:bg-[#012d5a] gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> Open in Curriculum Designer
            </Button>
          </Link>
        </div>

      <CheckinQrDialog
        open={boothQrOpen}
        onOpenChange={setBoothQrOpen}
        checkinUrl={BOOTH_URL}
        eventTitle="The Mental Fitness Score"
        subtitle="Scan to start a free team assessment"
      />
      </CardContent>
    </Card>
  );
}