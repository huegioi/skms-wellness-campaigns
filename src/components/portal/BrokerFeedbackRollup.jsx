import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, Users, Loader2, AlertCircle, ChevronDown, Activity } from 'lucide-react';
import HeroMetricCard from './HeroMetricCard';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';
import { getInstrumentKey, getScore, matchPairs, calcStats } from '@/components/feedback/instrumentMeta';

// Direction-of-good color for a delta.
function deltaColor(delta, directionOfGood = 'higher') {
  if (delta == null) return '#9ca3af';
  const isGood = directionOfGood === 'higher' ? delta >= 0 : delta <= 0;
  return isGood ? '#264d44' : '#dc2626';
}

// Compute WHO-5 matched-pair delta for a set of cohort assessment rows.
function who5DeltaForRows(rows) {
  const who5Rows = rows.filter(r => getInstrumentKey(r) === 'who5');
  const cohortResult = matchPairs(who5Rows, 'cohort_start', 'cohort_end');
  const challengeResult = matchPairs(who5Rows, 'challenge_day0', 'challenge_day14');
  const allPairs = [...cohortResult.pairs, ...challengeResult.pairs];
  const allDistinct = cohortResult.distinctStarts + challengeResult.distinctStarts;
  const stats = calcStats(allPairs, allDistinct, 'higher');
  return stats?.avgDelta ?? null;
}

// Compute average eNPS for a set of cohort assessment rows (with pulse fallback).
function avgEnpsForRows(cohortRows, pulseRows) {
  const enpsRows = cohortRows.filter(r => getInstrumentKey(r) === 'enps');
  const enpsScores = enpsRows.map(r => getScore(r)).filter(s => s != null);
  if (enpsScores.length) return enpsScores.reduce((s, v) => s + v, 0) / enpsScores.length;
  const npsScores = pulseRows.filter(r => r.nps_score != null).map(r => r.nps_score);
  return npsScores.length ? npsScores.reduce((s, v) => s + v, 0) / npsScores.length : null;
}

export default function BrokerFeedbackRollup({ clientCompanies = [], services = [] }) {
  const [expandedClient, setExpandedClient] = useState(null);
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
    enabled: true,
    retry: 1,
  });

  const { data: allCohortAssessments = [], isLoading: isLoadingCohort } = useQuery({
    queryKey: ['broker-cohort-rollup', clientIds.join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const results = await Promise.all(
        clientIds.map(id =>
          base44.entities.CohortAssessment.filter({ client_id: id }, '-submitted_at', 500)
        )
      );
      return results.flat();
    },
    enabled: true,
    retry: 1,
  });

  const isLoadingAll = isLoading || isLoadingCohort;

  // ── Hero metrics ────────────────────────────────────────────────────────────
  const activeClientCount = clientCompanies.length;

  const employeesReached = useMemo(() => {
    const pulseEmails = new Set(allResponses.map(r => (r.attendee_email || r.email_address || '').toLowerCase().trim()).filter(Boolean));
    const cohortEmails = new Set(allCohortAssessments.map(r => (r.participant_email || '').toLowerCase().trim()).filter(Boolean));
    const allEmails = new Set([...pulseEmails, ...cohortEmails]);
    return allEmails.size > 0 ? allEmails.size : allResponses.length;
  }, [allResponses, allCohortAssessments]);

  const aggregateWho5Delta = useMemo(
    () => who5DeltaForRows(allCohortAssessments),
    [allCohortAssessments]
  );

  const avgEnps = useMemo(
    () => avgEnpsForRows(allCohortAssessments, allResponses),
    [allCohortAssessments, allResponses]
  );

  // ── Per-client breakdown ────────────────────────────────────────────────────
  const clientBreakdown = useMemo(() => {
    return clientCompanies.map(c => {
      const responses = allResponses.filter(r => r.client_id === c.id);
      const cohortRows = allCohortAssessments.filter(r => r.client_id === c.id);

      const withConf = responses.filter(r => r.fit_confidence != null);
      const avgConf = withConf.length ? withConf.reduce((s, r) => s + r.fit_confidence, 0) / withConf.length : null;

      const who5Delta = who5DeltaForRows(cohortRows);
      const enps = avgEnpsForRows(cohortRows, responses);

      const impactTally = {};
      for (const r of responses) {
        if (Array.isArray(r.expected_impact)) {
          for (const impact of r.expected_impact) {
            impactTally[impact] = (impactTally[impact] || 0) + 1;
          }
        }
      }
      const impactEntries = Object.entries(impactTally).sort((a, b) => b[1] - a[1]);
      const topImpact = impactEntries.length > 0 ? impactEntries[0][0] : null;

      const clientServiceIds = [...new Set(responses.map(r => r.service_id).filter(Boolean))];
      const clientServices = clientServiceIds
        .map(id => services.find(s => s.id === id))
        .filter(Boolean);

      return { ...c, responseCount: responses.length, avgConf, who5Delta, enps, topImpact, clientServices };
    }).sort((a, b) => b.responseCount - a.responseCount);
  }, [allResponses, allCohortAssessments, clientCompanies, services]);

  return (
    <Card className="border-[#013f7c]/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#013f7c]">
          <BarChart2 className="w-5 h-5" />
          Portfolio Wellness Impact
        </CardTitle>
        <p className="text-xs text-gray-400 mt-0.5">Aggregated across your entire book of business — separate from your referral pipeline below</p>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Roll-up context note */}
        <div className="rounded-xl border border-[#e6e1d8] border-l-4 border-l-[#013f7c] p-4" style={{ backgroundColor: '#f9f8f5' }}>
          <p className="font-semibold text-[#013f7c] mb-1">How to read this</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            This shows how the companies you&rsquo;ve referred are responding to their wellness programs, combined across your whole book of business. The numbers are aggregated and anonymous — no individual employee is identified. In general, higher is better, and you&rsquo;re welcome to share these results with your clients.
          </p>
        </div>

        {/* Loading */}
        {isLoadingAll && (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading portfolio data…</span>
          </div>
        )}

        {/* Error */}
        {!isLoadingAll && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Could not load feedback data</p>
              <p className="text-xs text-red-500 mt-0.5">{error?.message || 'An unknown error occurred. Check console for details.'}</p>
            </div>
          </div>
        )}

        {/* No clients linked yet */}
        {!isLoadingAll && !error && clientIds.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No clients linked to your portal yet.</p>
            <p className="text-xs mt-1">Once clients are added to your book of business, aggregate feedback will appear here.</p>
          </div>
        )}

        {/* Data loaded */}
        {!isLoadingAll && !error && clientIds.length > 0 && (
          <>
            {/* Hero cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <HeroMetricCard
                label="Active Clients"
                value={activeClientCount}
                caption="Clients in your book of business."
                evidenceTier="Book size"
                color="#013f7c"
              />
              <HeroMetricCard
                label="Employees Reached"
                value={employeesReached}
                caption="Distinct participants across all clients."
                evidenceTier="Engagement"
                color="#013f7c"
              />
              <HeroMetricCard
                label="Wellbeing Change"
                value={aggregateWho5Delta != null ? `${aggregateWho5Delta >= 0 ? '+' : ''}${aggregateWho5Delta.toFixed(0)}` : '—'}
                caption={aggregateWho5Delta != null ? 'WHO-5 pre→post delta (matched participants).' : 'Awaiting pre/post data.'}
                evidenceTier="Uncontrolled pre/post"
                color="#264d44"
              />
              <HeroMetricCard
                label="Avg eNPS"
                value={avgEnps != null ? `${avgEnps.toFixed(1)}/10` : '—'}
                caption="Likelihood to recommend the program."
                evidenceTier="Advocacy"
                color="#013f7c"
              />
            </div>

            {/* Per-client list */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Client Breakdown</p>
              <p className="text-xs text-gray-400 mb-3">Click a client to see their compact summary. Full ROI reports are in the Book of Business section below.</p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {clientBreakdown.map(c => {
                  const isExpanded = expandedClient === c.id;
                  return (
                    <div key={c.id} className="bg-white">
                      <button
                        onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.company || c.name}</p>
                            {c.name && c.company && c.name !== c.company && (
                              <p className="text-xs text-gray-400 truncate">{c.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-gray-400">WHO-5</p>
                            {c.who5Delta != null ? (
                              <p className="text-sm font-bold" style={{ color: deltaColor(c.who5Delta, 'higher') }}>
                                {c.who5Delta >= 0 ? '+' : ''}{c.who5Delta.toFixed(0)}
                              </p>
                            ) : (
                              <p className="text-sm font-bold text-gray-300">—</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">responses</p>
                            <p className="text-sm font-bold text-[#013f7c]">{c.responseCount}</p>
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 bg-gray-50/50 grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Fit Confidence</p>
                            <p className="text-sm font-semibold text-gray-700">
                              {c.avgConf != null ? `${c.avgConf.toFixed(1)}/10` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">eNPS</p>
                            <p className="text-sm font-semibold text-gray-700">
                              {c.enps != null ? `${c.enps.toFixed(1)}/10` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Top Impact Area</p>
                            <p className="text-sm font-semibold text-gray-700">
                              {c.topImpact ? c.topImpact.split(' ').slice(0, 3).join(' ') + (c.topImpact.split(' ').length > 3 ? '…' : '') : '—'}
                            </p>
                          </div>
                          {c.clientServices?.length > 0 && (
                            <div className="col-span-2 sm:col-span-3 mt-1">
                              <p className="text-xs text-gray-400 mb-1.5">Programs & Assessments</p>
                              <div className="space-y-1.5">
                                {c.clientServices.map(sv => (
                                  <div key={sv.id} className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700">{sv.name}</span>
                                    {sv.included_assessments?.length > 0 && <AssessmentBadges assessments={sv.included_assessments} size="xs" />}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Honest-framing footer */}
        <p className="text-xs text-gray-400 text-center italic pt-1">
          This reflects participants&rsquo; experience and intended change across your referred clients. Sustained results build over time with continued programming.
        </p>

      </CardContent>
    </Card>
  );
}