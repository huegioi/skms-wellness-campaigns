import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, Users, TrendingUp, Loader2, AlertCircle } from 'lucide-react';

function avgConf(arr) {
  const withConf = arr.filter(r => r.fit_confidence != null);
  if (!withConf.length) return null;
  return withConf.reduce((s, r) => s + r.fit_confidence, 0) / withConf.length;
}

export default function BrokerFeedbackRollup({ clientCompanies = [] }) {
  const clientIds = clientCompanies.map(c => c.id);

  const { data: allResponses = [], isLoading, error } = useQuery({
    queryKey: ['broker-feedback-rollup', clientIds.join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const results = await Promise.all(
        clientIds.map(id =>
          base44.entities.FeedbackResponse.filter({ client_id: id }, '-submitted_at', 200)
        )
      );
      return results.flat();
    },
    // Always run — even with no clients, we want the zero-state to render
    enabled: true,
    retry: 1,
  });

  const impactTally = useMemo(() => {
    const tally = {};
    for (const r of allResponses) {
      if (Array.isArray(r.expected_impact)) {
        for (const impact of r.expected_impact) {
          tally[impact] = (tally[impact] || 0) + 1;
        }
      }
    }
    return tally;
  }, [allResponses]);

  const impactEntries = Object.entries(impactTally).sort((a, b) => b[1] - a[1]);
  const maxImpact = impactEntries[0]?.[1] || 1;

  const clientBreakdown = useMemo(() => {
    return clientCompanies.map(c => {
      const responses = allResponses.filter(r => r.client_id === c.id);
      const avg = avgConf(responses);
      return { ...c, responseCount: responses.length, avgConf: avg };
    }).sort((a, b) => b.responseCount - a.responseCount);
  }, [allResponses, clientCompanies]);

  const overallAvg = avgConf(allResponses);

  return (
    <Card className="border-[#013f7c]/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#013f7c]">
          <BarChart2 className="w-5 h-5" />
          Portfolio Wellness Impact
        </CardTitle>
        <p className="text-xs text-gray-400 mt-0.5">Aggregated across your entire book of business</p>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading portfolio data…</span>
          </div>
        )}

        {/* Error — surfaces RLS or network failures visibly */}
        {!isLoading && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Could not load feedback data</p>
              <p className="text-xs text-red-500 mt-0.5">{error?.message || 'An unknown error occurred. Check console for details.'}</p>
            </div>
          </div>
        )}

        {/* No clients linked yet */}
        {!isLoading && !error && clientIds.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No clients linked to your portal yet.</p>
            <p className="text-xs mt-1">Once clients are added to your book of business, aggregate feedback will appear here.</p>
          </div>
        )}

        {/* Data loaded */}
        {!isLoading && !error && clientIds.length > 0 && (
          <>
            {/* KPI row — always shows, zeros out if no responses */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Reach', value: allResponses.length, icon: Users, color: 'text-[#013f7c]', bg: 'bg-blue-50' },
                { label: 'Avg Fit Confidence', value: overallAvg != null ? `${overallAvg.toFixed(1)}/10` : '0/10', icon: TrendingUp, color: 'text-[#264d44]', bg: 'bg-green-50' },
                { label: 'Impact Areas', value: impactEntries.length, icon: BarChart2, color: 'text-purple-700', bg: 'bg-purple-50' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="rounded-xl bg-white border p-4 text-center shadow-sm">
                    <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-2`}>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Impact chart — shown when data exists, placeholder when empty */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aggregate Impact Areas</p>
              {impactEntries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3 border border-dashed rounded-lg">
                  No impact data yet — responses will populate this chart after sessions.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {impactEntries.map(([label, count]) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-700 mb-1">
                        <span>{label}</span>
                        <span className="font-bold text-[#264d44]">{count}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#264d44] transition-all"
                          style={{ width: `${Math.round((count / maxImpact) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-client breakdown — always shown */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client Breakdown</p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {clientBreakdown.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.company || c.name}</p>
                      {c.name && c.company && c.name !== c.company && (
                        <p className="text-xs text-gray-400">{c.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-bold text-[#013f7c]">{c.responseCount}</p>
                        <p className="text-xs text-gray-400">responses</p>
                      </div>
                      {c.avgConf != null ? (
                        <div>
                          <p className="text-sm font-bold text-[#264d44]">{c.avgConf.toFixed(1)}/10</p>
                          <p className="text-xs text-gray-400">avg score</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-gray-300">—</p>
                          <p className="text-xs text-gray-300">avg score</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}