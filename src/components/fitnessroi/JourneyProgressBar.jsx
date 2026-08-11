import React from 'react';

export default function JourneyProgressBar({ step, total }) {
  const pct = Math.min(100, (step / total) * 100);
  return (
    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-mf-plum rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}