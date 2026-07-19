import React from 'react';
import { SCORE_ZONES, getZone } from '@/lib/mfsScore';

export default function MfsScoreDial({ score, size = 180 }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score ?? 0));
  const offset = circumference - (clampedScore / 100) * circumference;

  const color = clampedScore >= 70 ? '#264d44' : clampedScore >= 50 ? '#013f7c' : '#770142';
  const zones = SCORE_ZONES.composite.zones;
  const zoneLabel = getZone('composite', score);

  // Compute zone arc segments
  let cumulative = 0;
  const zoneArcs = zones.map(z => {
    const segStart = cumulative;
    const segLength = ((z.max - cumulative) / 100) * circumference;
    cumulative = z.max;
    return { ...z, segLength, segStart };
  });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Zone background arcs */}
        {zoneArcs.map(z => (
          <circle
            key={z.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={z.color}
            strokeWidth="10"
            strokeDasharray={`${Math.max(0, z.segLength - 1.5)} ${circumference - Math.max(0, z.segLength - 1.5)}`}
            strokeDashoffset={-(z.segStart / 100) * circumference}
          />
        ))}
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-gray-800">{score != null ? Math.round(score) : '—'}</span>
        <span className="text-xs text-gray-400 mt-0.5">out of 100</span>
        {zoneLabel && <span className="text-[10px] text-gray-400 mt-0.5">{zoneLabel} zone</span>}
      </div>
    </div>
  );
}