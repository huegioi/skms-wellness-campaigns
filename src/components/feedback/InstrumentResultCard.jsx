import React from 'react';
import { Badge } from '@/components/ui/badge';
import { INSTRUMENT_META } from './instrumentMeta';

// One reusable result card per instrument.
// Shows: plain-language name, scale, interpretation, pre→post delta with
// direction-aware coloring, n / completion, and an evidence-tier badge.
export default function InstrumentResultCard({ instrumentKey, stats, evidenceTier }) {
  const meta = INSTRUMENT_META[instrumentKey];
  if (!meta || !stats) return null;

  const deltaColor = stats.isGood ? '#264d44' : '#ef4444';
  const sign = stats.avgDelta >= 0 ? '+' : '';

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
          <p className="text-xs text-gray-400 mb-0.5">Pre</p>
          <p className="text-lg font-bold text-gray-700">{stats.avgStart.toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">Post</p>
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
    </div>
  );
}