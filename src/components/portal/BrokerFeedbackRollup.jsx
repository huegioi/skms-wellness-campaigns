import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, Users, TrendingUp, Loader2 } from 'lucide-react';

function avgConf(arr) {
  const with_conf = arr.filter(r => r.fit_confidence != null);
  if (!with_conf.length) return null;
  return with_conf.reduce((s, r) => s + r.fit_confidence, 0) / with_conf.length;
}

export default function BrokerFeedbackRollup({ clientCompanies = [] }) {
  const clientIds = clientCompanies.map(c => c.id);

  // Fetch all FeedbackResponses for all of this broker's clients
  const { data: allResponses = [], isLoading } = useQuery({
    queryKey: ['broker-feedback-rollup', clientIds.join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      // Fetch in parallel per client
      const results = await Promise.all(
        clientIds.map(id => base44.entities.FeedbackResponse.filter({ client_id: id }, '-submitted_at', 200))
      );
      return results.flat();
    },
    enabled: clientIds.length > 0,
  });

  // Aggregate impact across all responses
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

  // Per-client breakdown
  const clientBreakdown = useMemo(() => {
    return clientCompanies.map(c => {
      const responses = allResponses.filter(r => r.client_id === c.id);
      const avg = avgConf(responses);
      return { ...c, responseCount: responses.length, avgConf: avg };
    }).sort((a, b) => b.responseCount - a.responseCount);
  }, [allResponses, clientCompanies]);

  const overallAvg = avgConf(allResponses);

  if (clientIds.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="w-5 h-5 text-[#013f7c]" />
          Portfolio Wellness Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Reach', value: allResponses.length, icon: Users, color: 'text-[#013f7c]', bg: 'bg-blue-50' },
                { label: 'Avg Fit Confidence', value: overallAvg != null ? `${overallAvg.toFixed(1)}/10` : '—', icon: TrendingUp, color: 'text-[#264d44]', bg: 'bg-green-50' },
                { label: 'Impact Areas', value: impactEntries.length, icon: BarChart2, color: 'text-[#770142]', bg: 'bg-rose-50' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="rounded-xl bg-white border p-4 text-center">
                    <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-2`}>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Aggregate Impact chart */}
            {impactEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aggregate Impact Areas</p>
                <div className="space-y-2.5">
                  {impactEntries.map(([label, count]) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-700 mb-1">
                        <span>{label}</span>
                        <span className="font-bold text-[#264d44]">{count}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#264d44]"
                          style={{ width: `${Math.round((count / maxImpact) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-client breakdown */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client Breakdown</p>
              {clientBreakdown.every(c => c.responseCount === 0) ? (
                <p className="text-sm text-gray-400 text-center py-4">No pulse responses collected yet. Share the feedback link after each session.</p>
              ) : (
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
                        {c.avgConf != null && (
                          <div>
                            <p className="text-sm font-bold text-[#264d44]">{c.avgConf.toFixed(1)}/10</p>
                            <p className="text-xs text-gray-400">avg score</p>
                          </div>
                        )}
                        {c.responseCount === 0 && (
                          <p className="text-xs text-gray-300">No data yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}