import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { INSTRUMENT_META, getInstrumentKey, getScore, normalizeScore } from './instrumentMeta';

// Cross-instrument "Wellbeing Profile" — shows all instruments side by side,
// each normalized to 0–100 with worse-direction instruments inverted so
// "up" always reads as better.
export default function WellbeingProfile({ assessments }) {
  const profile = useMemo(() => {
    const byInstrument = {};
    for (const r of assessments) {
      const key = getInstrumentKey(r);
      const score = getScore(r);
      if (score == null) continue;
      if (!byInstrument[key]) byInstrument[key] = [];
      byInstrument[key].push(score);
    }

    return Object.entries(byInstrument).map(([key, scores]) => {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const normalized = normalizeScore(avg, key);
      const meta = INSTRUMENT_META[key];
      return {
        key,
        label: meta?.label || key,
        normalized,
        n: scores.length,
      };
    }).filter(p => p.normalized != null);
  }, [assessments]);

  if (profile.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-[#013f7c]" />
        <p className="text-sm font-semibold text-gray-700">Wellbeing Profile</p>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        All instruments normalized to 0–100 (higher = better). PSS-4, UCLA-3, and CBI are inverted so &ldquo;up&rdquo; always reads as better.
      </p>
      <div className="space-y-3">
        {profile.map(p => (
          <div key={p.key}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{p.label} <span className="text-gray-400">({p.n})</span></span>
              <span className="font-semibold">{p.normalized.toFixed(0)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#264d44] transition-all"
                style={{ width: `${p.normalized}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}