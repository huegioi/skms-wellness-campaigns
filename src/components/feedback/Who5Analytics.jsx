import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Users } from 'lucide-react';
import InstrumentResultCard from './InstrumentResultCard';
import WellbeingProfile from './WellbeingProfile';
import { INSTRUMENT_META, getInstrumentKey, matchPairs, calcStats } from './instrumentMeta';

function EmptyState({ message }) {
  return (
    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
      <Activity className="w-16 h-16 mx-auto mb-4 text-gray-200" />
      <p className="text-lg font-semibold text-gray-600">{message}</p>
      <p className="text-sm text-gray-400 mt-1">Results appear once start and end responses are submitted.</p>
    </div>
  );
}

// Compute per-instrument matched-pair stats for a set of rows.
function buildInstrumentStats(rows, startType, endType) {
  const byInstrument = {};
  for (const r of rows) {
    const key = getInstrumentKey(r);
    if (!byInstrument[key]) byInstrument[key] = [];
    byInstrument[key].push(r);
  }
  return Object.entries(byInstrument).map(([key, rows]) => {
    const { pairs, distinctStarts } = matchPairs(rows, startType, endType);
    const meta = INSTRUMENT_META[key];
    const stats = calcStats(pairs, distinctStarts, meta?.directionOfGood || 'higher');
    return { key, stats };
  }).filter(s => s.stats);
}

export default function Who5Analytics({ filters }) {
  const { data: allAssessments = [], isLoading: loadingA } = useQuery({
    queryKey: ['cohort-assessments-all'],
    queryFn: () => base44.entities.CohortAssessment.list('-submitted_at', 2000),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-compact'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
  });

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filteredAssessments = useMemo(() => {
    return allAssessments.filter(r => {
      if (filters.company !== 'all') {
        const matchingClientIds = clients.filter(c => (c.company || c.name) === filters.company).map(c => c.id);
        if (!matchingClientIds.includes(r.client_id)) return false;
      }
      if (filters.cohortYear !== 'all') {
        const year = r.cohort_year || (r.submitted_at ? new Date(r.submitted_at).getFullYear() : null);
        if (String(year) !== filters.cohortYear) return false;
      }
      if (filters.startDate && r.submitted_at && r.submitted_at.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate   && r.submitted_at && r.submitted_at.slice(0, 10) > filters.endDate)   return false;
      // Touchpoint filter
      if (filters.touchpoint && filters.touchpoint !== 'all' && filters.touchpoint !== 'session_pulse') {
        const touchpointMap = { day0: 'challenge_day0', day14: 'challenge_day14', cohort_start: 'cohort_start', cohort_end: 'cohort_end' };
        if (touchpointMap[filters.touchpoint] && r.survey_type !== touchpointMap[filters.touchpoint]) return false;
      }
      return true;
    });
  }, [allAssessments, filters, clients]);

  const instrumentFilter = filters.instrument && filters.instrument !== 'all' && filters.instrument !== 'pulse';

  const cohortRows = useMemo(() =>
    filteredAssessments.filter(r =>
      (r.survey_type === 'cohort_start' || r.survey_type === 'cohort_end') &&
      (!instrumentFilter || getInstrumentKey(r) === filters.instrument)
    ),
    [filteredAssessments, instrumentFilter, filters.instrument]
  );

  const challengeRows = useMemo(() => {
    let rows = filteredAssessments.filter(r =>
      (r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14') &&
      (!instrumentFilter || getInstrumentKey(r) === filters.instrument)
    );
    if (filters.category !== 'all' && filters.category !== 'challenge') rows = [];
    return rows;
  }, [filteredAssessments, filters.category, instrumentFilter, filters.instrument]);

  const cohortInstrumentStats = useMemo(
    () => buildInstrumentStats(cohortRows, 'cohort_start', 'cohort_end'),
    [cohortRows]
  );

  const challengeInstrumentStats = useMemo(
    () => buildInstrumentStats(challengeRows, 'challenge_day0', 'challenge_day14'),
    [challengeRows]
  );

  if (loadingA) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#013f7c] rounded-full animate-spin mr-3" />
        Loading assessment data…
      </div>
    );
  }

  if (cohortRows.length === 0 && challengeRows.length === 0) {
    return <EmptyState message="No assessment data matches the current filters." />;
  }

  return (
    <div className="space-y-6">
      <WellbeingProfile assessments={filteredAssessments} />

      {/* By Cohort */}
      {cohortInstrumentStats.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#770142]" />
            <h3 className="text-sm font-semibold text-gray-700">By Cohort — Year Arc</h3>
            <span className="text-xs text-gray-400">cohort_start → cohort_end · matched comparison</span>
          </div>
          <div className="grid gap-4">
            {cohortInstrumentStats.map(({ key, stats }) => (
              <InstrumentResultCard
                key={key}
                instrumentKey={key}
                stats={stats}
                evidenceTier="Matched comparison"
              />
            ))}
          </div>
        </div>
      )}

      {/* By Challenge */}
      {challengeInstrumentStats.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[#264d44]" />
            <h3 className="text-sm font-semibold text-gray-700">By Challenge — Program Effect</h3>
            <span className="text-xs text-gray-400">Day 0 → Day 14 · uncontrolled pre/post</span>
          </div>
          <div className="grid gap-4">
            {challengeInstrumentStats.map(({ key, stats }) => (
              <InstrumentResultCard
                key={key}
                instrumentKey={key}
                stats={stats}
                evidenceTier="Program effect — uncontrolled pre/post"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}