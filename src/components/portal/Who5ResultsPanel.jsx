import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import InstrumentResultCard from '@/components/feedback/InstrumentResultCard';
import { INSTRUMENT_META, getInstrumentKey, matchPairs, calcStats } from '@/components/feedback/instrumentMeta';

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

export default function Who5ResultsPanel({ cohortAssessments = [], acceptedProposalId, services = [] }) {
  const cohortRows = cohortAssessments;

  // ── Section 1: Cohort arc ──────────────────────────────────────────────────
  const cohortRows_ = useMemo(() =>
    cohortRows.filter(r =>
      (r.survey_type === 'cohort_start' || r.survey_type === 'cohort_end') &&
      r.proposal_id === acceptedProposalId
    ),
    [cohortRows, acceptedProposalId]
  );
  const cohortInstrumentStats = useMemo(
    () => buildInstrumentStats(cohortRows_, 'cohort_start', 'cohort_end'),
    [cohortRows_]
  );

  // ── Section 2: By challenge ────────────────────────────────────────────────
  const challengeRows = useMemo(() =>
    cohortRows.filter(r => r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14'),
    [cohortRows]
  );
  const challengeInstrumentStats = useMemo(
    () => buildInstrumentStats(challengeRows, 'challenge_day0', 'challenge_day14'),
    [challengeRows]
  );

  return (
    <div className="space-y-4">
      {/* ── Section 1: Cohort arc ───────────────────────────────────────────── */}
      {acceptedProposalId && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-brand-plum" />
            <p className="text-sm font-semibold text-gray-700">Cohort Wellbeing — Whole Year</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">Year arc — matched comparison</p>
          {cohortInstrumentStats.length > 0 ? (
            <div className="grid gap-3">
              {cohortInstrumentStats.map(({ key, stats }) => (
                <InstrumentResultCard
                  key={key}
                  instrumentKey={key}
                  stats={stats}
                  evidenceTier="Matched comparison"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic py-3">Cohort results appear once Cohort Start and Cohort End responses come in.</p>
          )}
        </div>
      )}

      {/* ── Section 2: By challenge ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-brand-green" />
          <p className="text-sm font-semibold text-gray-700">Challenge Wellbeing — By Program</p>
        </div>
        <p className="text-xs text-gray-400 mb-3">Program effect — uncontrolled pre/post</p>
        {challengeInstrumentStats.length > 0 ? (
          <div className="grid gap-3">
            {challengeInstrumentStats.map(({ key, stats }) => (
              <InstrumentResultCard
                key={key}
                instrumentKey={key}
                stats={stats}
                evidenceTier="Program effect — uncontrolled pre/post"
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic py-3">Challenge results appear once Day 0 and Day 14 responses come in.</p>
        )}
      </div>
    </div>
  );
}