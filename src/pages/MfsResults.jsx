import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PortalShell, PortalLoading, PortalError } from '@/components/portal/PortalShell';
import { Button } from '@/components/ui/button';
import { Users, Brain, TrendingUp, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeScore } from '@/components/feedback/instrumentMeta';

export default function MfsResults() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getMfsResults', { token });
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
    else { setError(true); setLoading(false); }
  }, [token]);

  if (loading) return <PortalLoading accentColor="#013f7c" label="Loading results..." />;
  if (error || !data) return <PortalError heading="Dashboard not found" message="This results link is invalid or has expired." />;

  const { assessment, response_count, who5, pss4 } = data;
  const who5Norm = who5?.average != null ? normalizeScore(who5.average, 'who5') : null;
  const pss4Norm = pss4?.average != null ? normalizeScore(pss4.average, 'pss4') : null;

  const copyEmployeeLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/MfsSurvey?t=${token}`);
    toast.success('Employee survey link copied!');
  };

  const who5Interpretation = who5?.average != null
    ? who5.average < 50 ? 'Low wellbeing — signs of risk. Consider preventative action.'
    : who5.average < 65 ? 'Moderate wellbeing — room for improvement.'
    : who5.average < 80 ? 'Good wellbeing — a solid foundation.'
    : 'Excellent wellbeing — a thriving team.'
    : 'Not enough data yet.';

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
      {/* Goals */}
      {assessment.goals?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {assessment.goals.map(g => (
            <span key={g} className="text-xs bg-[#013f7c]/10 text-[#013f7c] px-2.5 py-1 rounded-full font-medium">
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Response count */}
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

      {response_count === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">No responses yet</h3>
          <p className="text-sm text-gray-400 mb-4">Share the survey link with your team to start collecting responses.</p>
          <Button onClick={copyEmployeeLink} className="bg-[#013f7c] hover:bg-[#012d5a] gap-2">
            <Copy className="w-4 h-4" /> Copy employee survey link
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* WHO-5 Score */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-[#013f7c]" />
              <span className="text-sm font-semibold text-gray-700">Mental Fitness Score</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">WHO-5 Wellbeing Index</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#013f7c]">{who5?.average ?? '—'}</span>
              <span className="text-sm text-gray-400 mb-1">/ 100</span>
            </div>
            <p className="text-xs text-gray-500">{who5Interpretation}</p>
            <p className="text-[10px] text-gray-400 mt-2">{who5?.count} response{who5?.count !== 1 ? 's' : ''}</p>
          </div>

          {/* PSS-4 Score */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#770142]" />
              <span className="text-sm font-semibold text-gray-700">Stress Level</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">PSS-4 Perceived Stress Scale</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#770142]">{pss4?.average ?? '—'}</span>
              <span className="text-sm text-gray-400 mb-1">/ 16</span>
            </div>
            <p className="text-xs text-gray-500">
              {pss4?.average != null
                ? pss4.average >= 8 ? 'Elevated stress — consider stress-reduction programs.'
                : 'Stress levels within a manageable range.'
                : 'Not enough data yet.'}
            </p>
            <p className="text-[10px] text-gray-400 mt-2">{pss4?.count} response{pss4?.count !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Wellbeing Profile bars */}
      {response_count > 0 && (who5Norm != null || pss4Norm != null) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mt-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Wellbeing Profile</p>
          <p className="text-xs text-gray-400 mb-4">
            All scores normalized to 0–100 (higher = better). Stress is inverted so "up" always reads as better.
          </p>
          <div className="space-y-3">
            {who5Norm != null && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Wellbeing</span>
                  <span className="font-semibold">{who5Norm.toFixed(0)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#013f7c]" style={{ width: `${who5Norm}%` }} />
                </div>
              </div>
            )}
            {pss4Norm != null && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Stress (inverted)</span>
                  <span className="font-semibold">{pss4Norm.toFixed(0)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#770142]" style={{ width: `${pss4Norm}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}