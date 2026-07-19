import React from 'react';
import { SCORE_ZONES, getZone, MFS_INSTRUMENTS } from '@/lib/mfsScore';
import MfsEvidenceBlock from '@/components/mfs/MfsEvidenceBlock';
import { MFS_DISCLAIMER } from '@/lib/mfsScoreContent';

const ZONE_LABEL_COLORS = {
  Low: 'text-rose-400',
  Typical: 'text-gray-400',
  High: 'text-emerald-400',
};

export default function MfsScoreBars({ instruments }) {
  return (
    <div className="space-y-4">
      {MFS_INSTRUMENTS.map(inst => {
        const data = instruments?.[inst.key];
        const score = data?.average;
        const zones = SCORE_ZONES[inst.key]?.zones || [];
        const zone = getZone(inst.key, score);
        return (
          <div key={inst.key}>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span className="font-medium">{inst.label}</span>
              <span className="font-semibold" style={{ color: inst.color }}>
                {score != null ? Math.round(score) : '—'}
                {zone && (
                  <span className={`ml-1.5 text-xs font-medium ${ZONE_LABEL_COLORS[zone] || 'text-gray-400'}`}>· {zone}</span>
                )}
              </span>
            </div>

            {/* Zone labels */}
            <div className="flex text-[8px] text-gray-300 mb-0.5 select-none">
              {zones.map((z, i) => (
                <span key={z.label} style={{ width: `${z.max - (zones[i - 1]?.max || 0)}%` }}>{z.label}</span>
              ))}
            </div>

            {/* Zone bar + score marker */}
            <div className="relative">
              <div className="relative h-3 rounded-full overflow-hidden flex">
                {zones.map((z, i) => (
                  <div
                    key={z.label}
                    className="h-full"
                    style={{ width: `${z.max - (zones[i - 1]?.max || 0)}%`, backgroundColor: z.color }}
                  />
                ))}
              </div>
              {score != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-4 rounded-full border border-white shadow-sm"
                  style={{ left: `calc(${Math.max(0, Math.min(100, score))}% - 2px)`, backgroundColor: inst.color }}
                />
              )}
            </div>

            <p className="text-[10px] text-gray-400 mt-1">
              {data?.count || 0} response{(data?.count || 0) !== 1 ? 's' : ''}
            </p>

            <MfsEvidenceBlock instrumentKey={inst.key} score={score} />
          </div>
        );
      })}

      {/* Legend */}
      <p className="text-[10px] text-gray-400 italic">Zones are based on published research norms for each instrument.</p>

      {/* Shared disclaimer */}
      <div className="pt-2 mt-1 border-t border-gray-100">
        <p className="text-xs text-gray-500 leading-relaxed">
          {MFS_DISCLAIMER.prefix}{' '}
          <a
            href={MFS_DISCLAIMER.calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#013f7c] font-medium hover:underline"
          >
            {MFS_DISCLAIMER.linkText}
          </a>
        </p>
      </div>
    </div>
  );
}