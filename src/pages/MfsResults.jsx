import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PortalShell, PortalLoading, PortalError } from '@/components/portal/PortalShell';
import { Button } from '@/components/ui/button';
import { Users, Copy, RefreshCw, CalendarCheck, TrendingUp, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import MfsScoreDial from '@/components/mfs/MfsScoreDial';
import MfsScoreBars from '@/components/mfs/MfsScoreBars';
import MfsReportButton from '@/components/mfs/MfsReportButton';

const AUTOREFRESH_MS = 60000;
const CALENDLY_URL = 'https://calendly.com/skillfulmeans/strategy-session';
const ANONYMITY_NOTE = 'All scores are aggregated and anonymous — no individual responses are shown.';

export default function MfsResults() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getMfsResults', { token });
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
    else { setError(true); setLoading(false); }
  }, [token, fetchData]);

  // 60-second auto-refresh
  useEffect(() => {
    if (!token || error) return;
    const interval = setInterval(fetchData, AUTOREFRESH_MS);
    return () => clearInterval(interval);
  }, [token, error, fetchData]);

  if (loading) return <PortalLoading accentColor="#013f7c" label="Loading results..." />;
  if (error || !data) return <PortalError heading="Dashboard not found" message="This results link is invalid or has expired." />;

  const { assessment, response_count, min_responses, locked, composite, instruments } = data;

  const copyEmployeeLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/MfsSurvey?t=${token}`);
    toast.success('Employee survey link copied!');
  };

  return (
    <PortalShell
      accentColor="#013f7c"
      title="Mental Fitness Score"
      subtitle={assessment.company_name ? `${assessment.company_name} — live results` : 'Live results'}
      maxWidth="max-w-3xl"
      headerRight={
        <div className="flex items-center gap-2">
          {!locked && <MfsReportButton data={data} token={token} />}
          <Button size="sm" variant="outline" onClick={fetchData} className="bg-white/10 text-white border-white/30 hover:bg-white/20">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      }
    >
      {/* Goals */}
      {assessment.goals?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {assessment.goals.map(g => (
            <span key={g} className="text-xs bg-[#013f7c]/10 text-[#013f7c] px-2.5 py-1 rounded-full font-medium">{g}</span>
          ))}
        </div>
      )}

      {/* Response count + copy link */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{response_count}</p>
            <p className="text-xs text-gray-400">employee response{response_count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={copyEmployeeLink} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Share survey
        </Button>
      </div>

      {/* 5-response privacy gate */}
      {locked ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-50">
            <Lock className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Results unlock at {min_responses} responses</h3>
          <p className="text-sm text-gray-400 mb-5">{response_count} of {min_responses} so far — keep sharing the survey link to protect anonymity. Individual responses are never shown — only group averages.</p>
          <Button onClick={copyEmployeeLink} className="bg-[#013f7c] hover:bg-[#012d5a] gap-2">
            <Copy className="w-4 h-4" /> Copy employee survey link
          </Button>
        </div>
      ) : (
        <>
          {/* Composite Score Dial */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 flex flex-col items-center">
            <p className="text-sm font-semibold text-gray-700 mb-4">Mental Fitness Score</p>
            <MfsScoreDial score={composite} />
            <p className="text-xs text-gray-400 mt-3">Composite of {response_count} anonymized response{response_count !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
              <ShieldCheck className="w-3 h-3" /> {ANONYMITY_NOTE}
            </div>
          </div>

          {/* Four sub-score bars */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">Score Breakdown</p>
            <p className="text-xs text-gray-400 mb-4">All scores 0–100 (higher = better).</p>
            <MfsScoreBars instruments={instruments} />
          </div>
        </>
      )}

      {/* CTA links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
          <div className="bg-[#013f7c] rounded-xl p-4 flex items-center gap-3 hover:bg-[#012d5a] transition-colors cursor-pointer">
            <CalendarCheck className="w-5 h-5 text-white shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Book your free strategy session</p>
              <p className="text-xs text-blue-200">30-min consultation with our team</p>
            </div>
          </div>
        </a>
        <Link to="/QuickBuilder">
          <div className="bg-[#264d44] rounded-xl p-4 flex items-center gap-3 hover:bg-[#223d32] transition-colors cursor-pointer">
            <TrendingUp className="w-5 h-5 text-white shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">ROI Engine</p>
              <p className="text-xs text-green-200">Estimate your campaign impact</p>
            </div>
          </div>
        </Link>
      </div>
    </PortalShell>
  );
}