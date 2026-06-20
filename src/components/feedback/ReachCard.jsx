import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';

// Reach / representativeness read.
// When an eligible-population roster exists: show responders ÷ eligible as %.
// When no roster exists: show responder count + note.
// Flag when responders look skewed (low response rate).
export default function ReachCard({ responderCount, eligibleCount, hasRoster }) {
  const reachPct = hasRoster && eligibleCount > 0
    ? Math.round((responderCount / eligibleCount) * 100)
    : null;
  const isSkewed = reachPct != null && reachPct < 20;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-[#013f7c]" />
        <p className="text-sm font-semibold text-gray-700">Reach / Representativeness</p>
      </div>
      {hasRoster && reachPct != null ? (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <p className="text-2xl font-bold text-gray-800">{reachPct}%</p>
            <p className="text-xs text-gray-400">
              {responderCount} responders ÷ {eligibleCount.toLocaleString()} eligible
            </p>
          </div>
          {isSkewed && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Low response rate — results may not represent the full population.</span>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-800">{responderCount}</p>
          <p className="text-xs text-gray-400">responders</p>
          <p className="text-xs text-gray-400 mt-2 italic">
            Representativeness can&rsquo;t be assessed without an eligible-population roster.
          </p>
        </>
      )}
    </div>
  );
}