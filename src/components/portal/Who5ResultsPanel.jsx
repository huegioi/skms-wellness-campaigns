import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity } from 'lucide-react';

// ─── Shared matching logic ────────────────────────────────────────────────────
function matchPairs(rows, startType, endType) {
  const starts = {};
  const ends = {};
  for (const r of rows) {
    const email = r.participant_email;
    if (r.survey_type === startType) starts[email] = r;
    if (r.survey_type === endType)   ends[email]   = r;
  }
  const pairs = [];
  for (const email of Object.keys(starts)) {
    if (ends[email]) {
      pairs.push({ email, start: starts[email].who5_total, end: ends[email].who5_total });
    }
  }
  const distinctStarts = Object.keys(starts).length;
  return { pairs, distinctStarts };
}

function calcStats(pairs, distinctStarts) {
  if (!pairs.length) return null;
  const n = pairs.length;
  const avgStart = pairs.reduce((s, p) => s + p.start, 0) / n;
  const avgEnd   = pairs.reduce((s, p) => s + p.end,   0) / n;
  const avgDelta = avgEnd - avgStart;
  const completion = distinctStarts > 0 ? Math.round((n / distinctStarts) * 100) : 0;
  return { n, avgStart, avgEnd, avgDelta, completion };
}

// ─── Before/After bar visual ──────────────────────────────────────────────────
function Who5Bars({ avgStart, avgEnd }) {
  const startPct = Math.round((avgStart / 100) * 100);
  const endPct   = Math.round((avgEnd   / 100) * 100);
  const up = avgEnd >= avgStart;
  return (
    <div className="space-y-2 mt-3">
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Start</span>
          <span className="font-semibold">{avgStart.toFixed(1)}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gray-400" style={{ width: `${startPct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>End</span>
          <span className="font-semibold">{avgEnd.toFixed(1)}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${endPct}%`, backgroundColor: up ? '#264d44' : '#ef4444' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Stats summary row ────────────────────────────────────────────────────────
function StatsRow({ stats }) {
  const deltaColor = stats.avgDelta >= 0 ? '#264d44' : '#ef4444';
  const sign = stats.avgDelta >= 0 ? '+' : '';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-0.5">Avg Start</p>
        <p className="text-lg font-bold text-gray-700">{stats.avgStart.toFixed(1)}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-0.5">Avg End</p>
        <p className="text-lg font-bold text-gray-700">{stats.avgEnd.toFixed(1)}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-0.5">Avg Change</p>
        <p className="text-lg font-bold" style={{ color: deltaColor }}>
          {sign}{stats.avgDelta.toFixed(1)}
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-0.5">Pairs (n) / Completion</p>
        <p className="text-lg font-bold text-gray-700">{stats.n} <span className="text-sm text-gray-400">/ {stats.completion}%</span></p>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <p className="text-xs text-gray-400 italic py-3">{message}</p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Who5ResultsPanel({ clientId, acceptedProposalId, services = [] }) {
  const [selectedChallenge, setSelectedChallenge] = useState('all');

  const { data: cohortRows = [], isLoading } = useQuery({
    queryKey: ['cohort-assessments', clientId],
    queryFn: () => base44.entities.CohortAssessment.filter({ client_id: clientId }, '-submitted_at', 500),
    enabled: !!clientId,
  });

  // ── Section 1: Cohort arc ──────────────────────────────────────────────────
  const cohortRows_ = useMemo(() =>
    cohortRows.filter(r =>
      (r.survey_type === 'cohort_start' || r.survey_type === 'cohort_end') &&
      r.proposal_id === acceptedProposalId
    ),
    [cohortRows, acceptedProposalId]
  );
  const { pairs: cohortPairs, distinctStarts: cohortDistinct } = useMemo(
    () => matchPairs(cohortRows_, 'cohort_start', 'cohort_end'),
    [cohortRows_]
  );
  const cohortStats = useMemo(() => calcStats(cohortPairs, cohortDistinct), [cohortPairs, cohortDistinct]);

  // ── Section 2: By challenge ────────────────────────────────────────────────
  const challengeRows = useMemo(() =>
    cohortRows.filter(r => r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14'),
    [cohortRows]
  );

  // Challenges that have at least one row
  const challengeServiceIds = useMemo(() => {
    const ids = new Set(challengeRows.map(r => r.service_id).filter(Boolean));
    return [...ids];
  }, [challengeRows]);

  const challengeOptions = useMemo(() =>
    services.filter(s => challengeServiceIds.includes(s.id)),
    [services, challengeServiceIds]
  );

  // Build per-challenge stats map
  const challengeStatsMap = useMemo(() => {
    const map = {};
    for (const svc of challengeOptions) {
      const rows = challengeRows.filter(r => r.service_id === svc.id);
      const { pairs, distinctStarts } = matchPairs(rows, 'challenge_day0', 'challenge_day14');
      map[svc.id] = { svc, pairs, distinctStarts, stats: calcStats(pairs, distinctStarts) };
    }
    return map;
  }, [challengeOptions, challengeRows]);

  // "All challenges" averaged
  const allChallengePairs = useMemo(() =>
    Object.values(challengeStatsMap).flatMap(d => d.pairs),
    [challengeStatsMap]
  );
  const allChallengeDistinct = useMemo(() =>
    Object.values(challengeStatsMap).reduce((s, d) => s + d.distinctStarts, 0),
    [challengeStatsMap]
  );
  const allChallengeStats = useMemo(
    () => calcStats(allChallengePairs, allChallengeDistinct),
    [allChallengePairs, allChallengeDistinct]
  );

  // Currently displayed challenge stats
  const displayedChallenge = selectedChallenge === 'all'
    ? { stats: allChallengeStats, pairs: allChallengePairs }
    : challengeStatsMap[selectedChallenge] || { stats: null, pairs: [] };

  if (isLoading) return null; // parent already shows a spinner

  return (
    <div className="space-y-4">
      {/* ── Section 1: Cohort arc ───────────────────────────────────────────── */}
      {acceptedProposalId && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-[#770142]" />
            <p className="text-sm font-semibold text-gray-700">Cohort Wellbeing — Whole Year</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">Year arc — pre/post (uncontrolled)</p>

          {cohortStats ? (
            <>
              <StatsRow stats={cohortStats} />
              <Who5Bars avgStart={cohortStats.avgStart} avgEnd={cohortStats.avgEnd} />
            </>
          ) : (
            <EmptyState message="Cohort results appear once Cohort Start and Cohort End responses come in." />
          )}
        </div>
      )}

      {/* ── Section 2: By challenge ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#264d44]" />
            <p className="text-sm font-semibold text-gray-700">Challenge Wellbeing — By Program</p>
          </div>
          {challengeOptions.length > 1 && (
            <select
              value={selectedChallenge}
              onChange={e => setSelectedChallenge(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#264d44]/20"
            >
              <option value="all">All Challenges</option>
              {challengeOptions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">Program effect — pre/post (uncontrolled)</p>

        {displayedChallenge.stats ? (
          <>
            <StatsRow stats={displayedChallenge.stats} />
            <Who5Bars
              avgStart={displayedChallenge.stats.avgStart}
              avgEnd={displayedChallenge.stats.avgEnd}
            />
          </>
        ) : (
          <EmptyState message="Challenge results appear once Day 0 and Day 14 responses come in." />
        )}
      </div>
    </div>
  );
}