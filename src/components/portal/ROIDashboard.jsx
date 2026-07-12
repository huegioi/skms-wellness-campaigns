import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { TrendingUp, MessageSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Who5ResultsPanel from './Who5ResultsPanel';
import HeroMetricCard from './HeroMetricCard';
import NarrativeSummary from './NarrativeSummary';
import EngagementTrendChart from './EngagementTrendChart';
import AdminLinkSection from './AdminLinkSection';
import MethodologyNote from '@/components/feedback/MethodologyNote';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';
import { getInstrumentKey, getScore, matchPairs, calcStats } from '@/components/feedback/instrumentMeta';

function ConfidenceBar({ value, max = 10 }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 7 ? '#264d44' : value >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{value}/10</span>
    </div>
  );
}

export default function ROIDashboard({ clientId, clientCompany, services = [], showReportButton = false, onGenerateReport, acceptedProposalId, clientToken, portalId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: roiData, isLoading } = useQuery({
    queryKey: ['roi-data', clientId, clientToken, portalId],
    queryFn: async () => {
      const payload = { client_id: clientId };
      if (clientToken) payload.client_token = clientToken;
      if (portalId) payload.portal_id = portalId;
      const res = await base44.functions.invoke('getRoiData', payload);
      return res.data;
    },
    enabled: !!clientId,
  });

  const allResponses = roiData?.feedback_responses || [];
  const cohortAssessments = roiData?.cohort_assessments || [];

  // Universal Pulse responses only
  const pulseResponses = useMemo(
    () => allResponses.filter(r => r.behavior_intent || r.fit_confidence != null),
    [allResponses]
  );

  // ── Hero metric: People engaged ─────────────────────────────────────────────
  const peopleEngaged = useMemo(() => {
    const pulseEmails = new Set(pulseResponses.map(r => (r.attendee_email || r.email_address || '').toLowerCase().trim()).filter(Boolean));
    const cohortEmails = new Set(cohortAssessments.map(r => (r.participant_email || '').toLowerCase().trim()).filter(Boolean));
    const allEmails = new Set([...pulseEmails, ...cohortEmails]);
    return allEmails.size > 0 ? allEmails.size : pulseResponses.length;
  }, [pulseResponses, cohortAssessments]);

  // ── Hero metric: Wellbeing change (WHO-5 delta) ────────────────────────────
  const who5Delta = useMemo(() => {
    const who5Rows = cohortAssessments.filter(r => getInstrumentKey(r) === 'who5');
    const cohortResult = matchPairs(who5Rows, 'cohort_start', 'cohort_end');
    const challengeResult = matchPairs(who5Rows, 'challenge_day0', 'challenge_day14');
    const allPairs = [...cohortResult.pairs, ...challengeResult.pairs];
    const allDistinct = cohortResult.distinctStarts + challengeResult.distinctStarts;
    const stats = calcStats(allPairs, allDistinct, 'higher');
    return stats?.avgDelta ?? null;
  }, [cohortAssessments]);

  // ── Hero metric: Top impact area ────────────────────────────────────────────
  const topImpact = useMemo(() => {
    const tally = {};
    for (const r of pulseResponses) {
      if (Array.isArray(r.expected_impact)) {
        for (const impact of r.expected_impact) {
          tally[impact] = (tally[impact] || 0) + 1;
        }
      }
    }
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    return entries.length > 0 ? entries[0][0].split(' ').slice(0, 2).join(' ') + '…' : null;
  }, [pulseResponses]);

  // ── Hero metric: eNPS ────────────────────────────────────────────────────────
  const avgEnps = useMemo(() => {
    // Prefer CohortAssessment enps data
    const enpsRows = cohortAssessments.filter(r => getInstrumentKey(r) === 'enps');
    const enpsScores = enpsRows.map(r => getScore(r)).filter(s => s != null);
    if (enpsScores.length) return enpsScores.reduce((s, v) => s + v, 0) / enpsScores.length;
    // Fall back to FeedbackResponse nps_score
    const npsScores = pulseResponses.filter(r => r.nps_score != null).map(r => r.nps_score);
    return npsScores.length ? npsScores.reduce((s, v) => s + v, 0) / npsScores.length : null;
  }, [cohortAssessments, pulseResponses]);

  // ── Narrative year ───────────────────────────────────────────────────────────
  const narrativeYear = useMemo(() => {
    const allDates = [
      ...pulseResponses.map(r => r.submitted_at),
      ...cohortAssessments.map(r => r.submitted_at),
    ].filter(Boolean).sort().reverse();
    return allDates.length > 0 ? new Date(allDates[0]).getFullYear() : null;
  }, [pulseResponses, cohortAssessments]);

  // ── Detailed breakdown data (for collapsible section) ──────────────────────
  const avgConfidence = useMemo(() => {
    const withConf = pulseResponses.filter(r => r.fit_confidence != null);
    return withConf.length ? withConf.reduce((s, r) => s + r.fit_confidence, 0) / withConf.length : null;
  }, [pulseResponses]);

  const voiceQuotes = useMemo(
    () => pulseResponses.filter(r => r.behavior_intent?.trim().length > 10).slice(0, 5),
    [pulseResponses]
  );

  const impactEntries = useMemo(() => {
    const tally = {};
    for (const r of pulseResponses) {
      if (Array.isArray(r.expected_impact)) {
        for (const impact of r.expected_impact) {
          tally[impact] = (tally[impact] || 0) + 1;
        }
      }
    }
    return Object.entries(tally).sort((a, b) => b[1] - a[1]);
  }, [pulseResponses]);

  const maxImpact = impactEntries[0]?.[1] || 1;

  const serviceStats = useMemo(() =>
    services
      .filter(s => pulseResponses.some(r => r.service_id === s.id))
      .map(s => {
        const sR = pulseResponses.filter(r => r.service_id === s.id);
        const sConf = sR.filter(r => r.fit_confidence != null);
        const avgConf = sConf.length ? (sConf.reduce((a, r) => a + r.fit_confidence, 0) / sConf.length) : null;
        return { id: s.id, name: s.name, count: sR.length, avgConf };
      }),
    [services, pulseResponses]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-brand-navy rounded-full animate-spin mr-3" />
        Loading...
      </div>
    );
  }

  const hasData = pulseResponses.length > 0 || cohortAssessments.length > 0;

  return (
    <div className="space-y-6">

      {/* How to read this */}
      <div className="rounded-xl p-5 border border-[#e6e1d8] border-l-4 border-l-brand-navy" style={{ backgroundColor: '#f9f8f5' }}>
        <p className="font-semibold text-brand-navy mb-1.5">How to read this</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          This dashboard shows how your team is responding to your wellness programs. After each session, participants complete a quick, anonymous 90-second pulse; for challenges, they also complete a short validated wellbeing check-in before and after. Everything below is aggregated across your programs — no individual is ever identified. In general, higher numbers are better.
        </p>
      </div>

      {/* Header with report button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Wellness Impact Dashboard</h3>
          <p className="text-sm text-gray-500">{peopleEngaged} people engaged{clientCompany ? ` · ${clientCompany}` : ''}</p>
        </div>
        {showReportButton && onGenerateReport && (
          <Button onClick={onGenerateReport} className="bg-brand-navy text-white text-xs">
            Generate Client Report
          </Button>
        )}
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No feedback data yet.</p>
          <p className="text-sm mt-1">
            {isAdmin ? 'Share survey links from the admin section below to start collecting data.' : 'Data will appear once sessions are completed and feedback is collected.'}
          </p>
        </div>
      ) : (
        <>
          {/* Hero metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <HeroMetricCard
              label="People Engaged"
              value={peopleEngaged}
              caption="Distinct participants across all programs."
              evidenceTier="Engagement"
              color="#013f7c"
            />
            <HeroMetricCard
              label="Wellbeing Change"
              value={who5Delta != null ? `${who5Delta >= 0 ? '+' : ''}${who5Delta.toFixed(0)}` : '—'}
              caption={who5Delta != null ? "WHO-5 pre→post delta (matched participants)." : 'Awaiting pre/post data.'}
              evidenceTier="Uncontrolled pre/post"
              color="#264d44"
            />
            <HeroMetricCard
              label="Top Impact Area"
              value={topImpact || '—'}
              caption="The outcome people most expect to improve."
              evidenceTier="Self-reported"
              color="#770142"
            />
            <HeroMetricCard
              label="eNPS"
              value={avgEnps != null ? `${avgEnps.toFixed(1)}/10` : '—'}
              caption="Likelihood to recommend the program."
              evidenceTier="Advocacy"
              color="#013f7c"
            />
          </div>

          {/* Narrative summary */}
          <NarrativeSummary
            year={narrativeYear}
            peopleEngaged={peopleEngaged}
            who5Delta={who5Delta}
            evidenceTier="uncontrolled pre/post"
          />

          {/* Trend chart */}
          <EngagementTrendChart
            pulseResponses={pulseResponses}
            cohortAssessments={cohortAssessments}
          />

          {/* Collapsible details section */}
          <div className="rounded-xl border border-[#e6e1d8] overflow-hidden" style={{ backgroundColor: '#f9f8f5' }}>
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-brand-cream transition-colors"
            >
              <span className="text-sm font-semibold text-brand-navy">See the details / How we measured this</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
            </button>
            {detailsOpen && (
              <div className="px-5 pb-5 space-y-6">
                {/* Per-instrument cards (cohort + challenge breakdowns) */}
                <Who5ResultsPanel
                  cohortAssessments={cohortAssessments}
                  acceptedProposalId={acceptedProposalId}
                  services={services}
                />

                {/* Per-service breakdown */}
                {serviceStats.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-0.5">By Program</p>
                    <p className="text-xs text-gray-400 mb-3">The same results, broken out by each workshop or challenge.</p>
                    <div className="space-y-3">
                      {serviceStats.map(s => (
                        <div key={s.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <p className="font-medium text-sm text-gray-800">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.count} response{s.count !== 1 ? 's' : ''}</p>
                              {(() => {
                                const svc = services.find(sv => sv.id === s.id);
                                return svc?.included_assessments?.length > 0 && (
                                  <div className="mt-1.5"><AssessmentBadges assessments={svc.included_assessments} size="xs" /></div>
                                );
                              })()}
                            </div>
                            <div className="text-right text-xs">
                              {s.avgConf != null && <p className="text-brand-green font-semibold">{s.avgConf.toFixed(1)}/10 confidence</p>}
                            </div>
                          </div>
                          {s.avgConf != null && <ConfidenceBar value={parseFloat(s.avgConf.toFixed(1))} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected Impact Chart */}
                {impactEntries.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <p className="text-sm font-semibold text-gray-700 mb-0.5">Expected Impact Areas</p>
                    <p className="text-xs text-gray-400 mb-3">Where participants expect the biggest benefit. They can choose more than one, so totals may exceed the number of responses.</p>
                    <div className="space-y-2">
                      {impactEntries.map(([label, count]) => (
                        <div key={label}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{label}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-brand-green" style={{ width: `${Math.round((count / maxImpact) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Voices */}
                {voiceQuotes.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-brand-navy" />
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Voices — What They'll Do Differently</p>
                        <p className="text-xs text-gray-400 mt-0.5">In their own words — the specific changes people committed to after a session.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {voiceQuotes.map((r, i) => (
                        <blockquote key={i} className="text-sm text-gray-600 border-l-4 border-brand-green/30 pl-3 italic">
                          "{r.behavior_intent}"
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}

                {/* Methodology */}
                <MethodologyNote />
              </div>
            )}
          </div>
        </>
      )}

      {/* Admin-only survey links (hidden from client view) */}
      {isAdmin && (
        <AdminLinkSection
          clientId={clientId}
          acceptedProposalId={acceptedProposalId}
          services={services}
          pulseResponses={pulseResponses}
        />
      )}

      {/* Honest-framing footer */}
      <div className="rounded-xl p-4 border border-[#e6e1d8] text-center" style={{ backgroundColor: '#f9f8f5' }}>
        <p className="text-xs text-gray-600 italic">
          This measures participants' experience and intended change. Sustained results build over time with continued programming.
        </p>
      </div>
    </div>
  );
}