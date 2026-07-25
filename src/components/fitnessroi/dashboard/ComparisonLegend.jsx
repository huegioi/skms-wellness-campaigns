import React from 'react';

const BAND_SWATCHES = [
  { label: 'Low', color: '#fecaca' },
  { label: 'Typical', color: '#e5e7eb' },
  { label: 'High', color: '#bbf7d0' },
];

export default function ComparisonLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: '#4a2040' }} />
        <span className="text-xs text-stone-600">You — your estimate from the quick assessment</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: '#0f766e' }} />
        <span className="text-xs text-stone-600">Your team — measured from their responses</span>
      </div>
      <div className="flex items-center gap-2">
        {BAND_SWATCHES.map(b => (
          <div key={b.label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm border border-stone-200" style={{ backgroundColor: b.color }} />
            <span className="text-xs text-stone-600">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}