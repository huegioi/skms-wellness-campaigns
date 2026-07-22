import React from 'react';
import { SCORE_ZONES, getZone, MFS_INSTRUMENTS } from '@/lib/mfsScore';
import JourneyEvidenceBlock from '@/components/fitnessroi/JourneyEvidenceBlock';

const DOMAINS = [
  { key: 'who5', label: 'Wellbeing' },
  { key: 'pss4', label: 'Stress' },
  { key: 'uwes3', label: 'Engagement' },
  { key: 'ucla3', label: 'Connection' },
];

const COLOR_MAP = Object.fromEntries(MFS_INSTRUMENTS.map(i => [i.key, i.color]));

export default function PairedDomainBars({ leaderScores, teamScores }) {
  return (
    <div className="space-y-5">
      {DOMAINS.map(d => {
        const leader = leaderScores?.[d.key];
        const team = teamScores?.[d.key];
        const zones = SCORE_ZONES[d.key]?.zones || [];
        const rows = [
          { label: 'You', val: leader, color: '#4a2040' },
          { label: 'Team', val: team, color: '#0f766e' },
        ];
        return (
          <div key={d.key}>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-sm font-medium text-stone-600">{d.label}</p>
              {leader != null && team != null && (
                <p className="text-[10px] text-stone-400">
                  You: {Math.round(leader)} · Team: {Math.round(team)}
                  <span className={`ml-1 font-semibold ${team < leader ? 'text-amber-600' : team > leader ? 'text-emerald-600' : 'text-stone-400'}`}>
                    ({team > leader ? '+' : ''}{Math.round(team - leader)})
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              {rows.map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 w-10 shrink-0">{row.label}</span>
                  <div className="relative h-3 rounded-full overflow-hidden flex flex-1">
                    {zones.map((z, i) => (
                      <div key={z.label} className="h-full"
                        style={{ width: `${z.max - (zones[i - 1]?.max || 0)}%`, backgroundColor: z.color }} />
                    ))}
                    {row.val != null && (
                      <div className="absolute top-0 h-full rounded-full transition-all duration-700"
                        style={{ left: `calc(${Math.min(100, Math.max(0, row.val))}% - 2px)`, width: '4px', backgroundColor: row.color }} />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-stone-600 w-8 text-right">{row.val != null ? Math.round(row.val) : '—'}</span>
                </div>
              ))}
            </div>
            <JourneyEvidenceBlock instrumentKey={d.key} score={team} />
          </div>
        );
      })}
    </div>
  );
}