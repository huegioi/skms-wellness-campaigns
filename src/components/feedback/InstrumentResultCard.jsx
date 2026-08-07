import React from 'react';
import { Badge } from '@/components/ui/badge';
import { INSTRUMENT_META, describeChange } from './instrumentMeta';

// One reusable result card per instrument.
// Shows: plain-language name, scale, interpretation, pre→post delta with
// direction-aware coloring, n / completion, and an evidence-tier badge.
// startLabel / endLabel let each section name its own before/after explicitly
// ("Program Start" → "1 Month After") instead of the generic Pre/Post, so a
// follow-up survey is never read as an end-of-program one. Defaults preserve
// the original wording for existing callers.
export default function InstrumentResultCard({
  instrumentKey,
  stats,
  evidenceTier,
  startLabel = 'Pre',
  endLabel = 'Post',
}) {
  const meta = INSTRUMENT_META[instrumentKey];
  if (!meta || !stats) return null;

  const deltaColor = stats.isGood ? '#264d44' : '#ef4444';
  const sign = stats.avgDelta >= 0 ? '+' : '';
  // Plain-language read of the delta, phrased with this section's own time-point
  // labels so "1 month after" never reads as "end of program".
  const narrative = describeChange(instrumentKey, stats, { startLabel, endLabel });

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
          <p className="text-xs text-gray-400">{meta.scale}</p>
        </div>
        <Badge variant="outline" className="text-xs border-gray-200 text-gray-500 whitespace-nowrap">
          {evidenceTier}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{meta.interpretation}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">{startLabel}</p>
          <p className="text-lg font-bold text-gray-700">{stats.avgStart.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">{endLabel}</p>
          <p className="text-lg font-bold text-gray-700">{stats.avgEnd.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">Change</p>
          <p className="text-lg font-bold" style={{ color: deltaColor }}>
            {sign}{stats.avgDelta.toFixed(1)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">n / Completion</p>
          <p className="text-lg font-bold text-gray-700">
            {stats.n} <span className="text-sm text-gray-400">/ {stats.completion}%</span>
          </p>
        </div>
      </div>
      {narrative && (
        <p className="text-xs text-gray-600 leading-relaxed mt-3 pt-3 border-t">
          <span className="font-semibold text-gray-700">What this means: </span>
          {narrative}
        </p>
      )}
    </div>
  );
}