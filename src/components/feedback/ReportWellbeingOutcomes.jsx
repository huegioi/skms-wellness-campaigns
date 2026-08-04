import React, { useMemo } from 'react';
import { INSTRUMENT_META, getInstrumentKey, matchPairs, calcStats } from '@/components/feedback/instrumentMeta';

function buildStats(rows, startType, endTypes) {
  const byInstrument = {};
  for (const r of rows) {
    const key = getInstrumentKey(r);
    if (!byInstrument[key]) byInstrument[key] = [];
    byInstrument[key].push(r);
  }
  return Object.entries(byInstrument)
    .map(([key, rs]) => {
      const { pairs, distinctStarts } = matchPairs(rs, startType, endTypes);
      const meta = INSTRUMENT_META[key];
      const stats = calcStats(pairs, distinctStarts, meta?.directionOfGood || 'higher');
      return { key, stats, meta };
    })
    .filter(s => s.stats);
}

function InstrumentCard({ item }) {
  const { key, stats, meta } = item;
  const label = meta?.label || key;
  const deltaColor = stats.isGood ? '#22c55e' : '#ef4444';
  return (
    <div key={key} className="border rounded-lg p-3">
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <span className="text-xs text-gray-400">n={stats.n}</span>
      </div>
      {stats.n < 5 ? (
        <p className="text-xs text-gray-400 italic">Collecting data (n={stats.n})</p>
      ) : (
        <div className="text-xs">
          <p className="font-semibold" style={{ color: deltaColor }}>
            {stats.avgDelta >= 0 ? '+' : ''}{stats.avgDelta.toFixed(1)} change
          </p>
          <p className="text-gray-500 mt-0.5">
            {stats.avgStart.toFixed(1)} → {stats.avgEnd.toFixed(1)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReportWellbeingOutcomes({ cohortAssessments = [] }) {
  const cohortStats = useMemo(
    () => buildStats(cohortAssessments, 'cohort_start', ['cohort_end', 'session_check']),
    [cohortAssessments]
  );
  const challengeStats = useMemo(
    () => buildStats(cohortAssessments, 'challenge_day0', 'challenge_day14'),
    [cohortAssessments]
  );

  const hasData = cohortStats.length > 0 || challengeStats.length > 0;
  if (!hasData) return null;

  return (
    <div>
      <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide mb-3">Wellbeing Outcomes</h2>
      <p className="text-xs text-gray-400 mb-3">Validated instrument scores — matched pre/post comparison. n reflects matched pairs.</p>
      <div className="space-y-4">
        {cohortStats.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Cohort Programs (pre → post)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cohortStats.map(item => <InstrumentCard key={item.key} item={item} />)}
            </div>
          </div>
        )}
        {challengeStats.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Challenges (Day 0 → Day 14)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {challengeStats.map(item => <InstrumentCard key={item.key} item={item} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}