import React from 'react';

export default function MfsScoreDial({ score, size = 180 }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score ?? 0));
  const offset = circumference - (clampedScore / 100) * circumference;

  const color = clampedScore >= 70 ? '#264d44' : clampedScore >= 50 ? '#013f7c' : '#770142';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-gray-800">{score != null ? Math.round(score) : '—'}</span>
        <span className="text-xs text-gray-400 mt-0.5">out of 100</span>
      </div>
    </div>
  );
}