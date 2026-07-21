import React from 'react';
import { SCORE_ZONES, getZone, MFS_INSTRUMENTS } from '@/lib/mfsScore';

const DOMAINS = [
  { key: 'who5', label: 'Wellbeing' },
  { key: 'pss4', label: 'Stress' },
  { key: 'uwes3', label: 'Engagement' },
  { key: 'ucla3', label: 'Connection' },
];

const COLOR_MAP = Object.fromEntries(MFS_INSTRUMENTS.map(i => [i.key, i.color]));

export default function JourneyScoreBars({ scores }) {
  return (
    <div className="space-y-3">
      {DOMAINS.map(d => {
        const score = scores?.[d.key];
        const zones = SCORE_ZONES[d.key]?.zones || [];
        const zone = getZone(d.key, score);
        return (
          <div key={d.key}>
            <div className="flex justify-between text-sm text-stone-600 mb-1">
              <span className="font-medium">{d.label}</span>
              <span className="font-semibold" style={{ color: COLOR_MAP[d.key] || '#4a2040' }}>
                {score != null ? Math.round(score) : '—'}
                {zone && <span className="ml-1.5 text-xs text-stone-400">· {zone}</span>}
              </span>
            </div>
            <div className="relative">
              <div className="relative h-3 rounded-full overflow-hidden flex">
                {zones.map((z, i) => (
                  <div key={z.label} className="h-full"
                    style={{ width: `${z.max - (zones[i - 1]?.max || 0)}%`, backgroundColor: z.color }} />
                ))}
              </div>
              {score != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full border border-white shadow-sm"
                  style={{ left: `calc(${Math.max(0, Math.min(100, score))}% - 2px)`, backgroundColor: COLOR_MAP[d.key] || '#4a2040' }}
                />
              )}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-stone-400 italic mt-2">Zones based on published research norms for each instrument.</p>
    </div>
  );
}