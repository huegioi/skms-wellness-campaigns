import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PortalShell, PortalLoading, PortalError } from '@/components/portal/PortalShell';
import { Button } from '@/components/ui/button';
import { Users, Copy, RefreshCw, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import MfsScoreDial from '@/components/mfs/MfsScoreDial';
import MfsScoreBars from '@/components/mfs/MfsScoreBars';
import MfsReportButton from '@/components/mfs/MfsReportButton';
import MfsCtaPair from '@/components/mfs/MfsCtaPair';
import MfsBottomCta from '@/components/mfs/MfsBottomCta';

const AUTOREFRESH_MS = 60000;
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
        <Button size="sm" variant="outline" onClick={fetchData} className="bg-white/10 text-white border-white/30 hover:bg-white/20">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      }
    >
      {/* Opening header block */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h1 className="text-xl font-bold text-[#013f7c] mb-2">Your Team's Mental Fitness Score</h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">
          This is a live, anonymous snapshot of your team's mental fitness across four research-validated measures: wellbeing, stress, engagement, and connection. Scores update as more employees respond — individual answers are never shown.
        </p>
        <p className="text-xs text-gray-400 font-medium">
          {assessment.company_name || 'Your team'}{assessment.employee_count ? ` · ${assessment.employee_count} employees` : ''} · {response_count} response{response_count !== 1 ? 's' : ''}
        </p>
      </div>

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
            <p className="text-xl font-bold text-gray-800 mb-4">Mental Fitness Score</p>
            <MfsScoreDial score={composite} />
            <p className="text-xs text-gray-400 mt-3">Composite of {response_count} anonymized response{response_count !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
              <ShieldCheck className="w-3 h-3" /> {ANONYMITY_NOTE}
            </div>
            {/* Paired CTAs */}
            <div className="w-full mt-4">
              <MfsCtaPair employeeCount={assessment.employee_count} />
            </div>
          </div>

          {/* Four sub-score bars */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">Score Breakdown</p>
            <p className="text-xs text-gray-400 mb-4">All scores 0–100 (higher = better).</p>
            <MfsScoreBars instruments={instruments} />
          </div>

          {/* Download report card */}
          <MfsReportButton data={data} token={token} />
        </>
      )}

      {/* Bottom CTA — matches PDF report treatment */}
      <div className="mb-4">
        <MfsBottomCta employeeCount={assessment.employee_count} />
      </div>
    </PortalShell>
  );
}