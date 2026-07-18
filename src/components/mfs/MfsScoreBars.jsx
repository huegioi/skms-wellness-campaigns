import React from 'react';
import { TYPICAL_BANDS, MFS_INSTRUMENTS } from '@/lib/mfsScore';

export default function MfsScoreBars({ instruments }) {
  return (
    <div className="space-y-4">
      {MFS_INSTRUMENTS.map(inst => {
        const data = instruments?.[inst.key];
        const score = data?.average;
        const band = TYPICAL_BANDS[inst.key];
        const [bandMin, bandMax] = band?.typicalRange || [0, 0];
        return (
          <div key={inst.key}>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span className="font-medium">{inst.label}</span>
              <span className="font-semibold" style={{ color: inst.color }}>
                {score != null ? Math.round(score) : '—'}
              </span>
            </div>
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
              {/* Typical range band overlay */}
              <div className="absolute h-full bg-gray-300/50" style={{ left: `${bandMin}%`, width: `${bandMax - bandMin}%` }} />
              {/* Score fill */}
              <div className="h-full rounded-full transition-all duration-700 relative" style={{ width: `${score ?? 0}%`, backgroundColor: inst.color }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Typical range: {bandMin}–{bandMax} · {data?.count || 0} response{(data?.count || 0) !== 1 ? 's' : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}