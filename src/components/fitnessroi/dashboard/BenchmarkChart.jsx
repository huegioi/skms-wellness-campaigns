import React from 'react';

/**
 * Our year-one return against every published benchmark we could verify.
 *
 * The dashed line is RESEARCH_MODEL.ceiling — the highest ROI any credible
 * published source reports for a whole-population workplace programme
 * (Deloitte UK, 6.3:1). It is a bound, not a target. Anything of ours sitting
 * above it means a coefficient is too generous, not that we are winning.
 *
 * Ratios are DIMENSIONLESS. Never currency-convert one: £6.30 per £1 is
 * $6.30 per $1.
 */
export default function BenchmarkChart({ scenarios }) {
  const marks = scenarios?.benchmarks || [];
  const ceiling = scenarios?.ceiling ?? 6.3;
  const ours = (scenarios?.all || []).map(s => ({
    v: s.year1PerDollar, label: s.label, dim: !s.clientFacing,
  }));
  if (!marks.length) return null;

  const max = Math.max(ceiling, ...marks.map(m => m.v), ...ours.map(o => o.v)) * 1.08;
  const x = (v) => (v / max) * 100;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#4a2040] mb-1">Against published benchmarks</h3>
      <p className="text-xs text-stone-500 leading-relaxed mb-4">
        Year-one return per dollar. The dashed line is the ceiling of research-based effect — the highest
        ROI any credible published source reports for a whole-population workplace programme.
      </p>

      {/* Published benchmarks */}
      <div className="space-y-1.5 mb-4">
        {marks.map((m, i) => (
          <div key={i} className="group">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] text-stone-500">{m.label}</span>
              <span className="text-[11px] text-stone-400 tabular-nums shrink-0">{m.v.toFixed(2)}:1</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full bg-stone-300" style={{ width: `${x(m.v)}%` }} />
            </div>
            <p className="text-[10px] text-stone-400 leading-snug mt-0.5 hidden group-hover:block">{m.note}</p>
          </div>
        ))}
      </div>

      {/* Ours, on the same scale */}
      <div className="pt-3 border-t border-stone-100 space-y-1.5">
        {ours.map((o, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[11px] font-semibold ${o.dim ? 'text-stone-400' : 'text-[#4a2040]'}`}>
                {o.label}{o.dim && ' · internal'}
              </span>
              <span className="text-[11px] tabular-nums shrink-0 font-semibold text-[#0f766e]">
                {o.v.toFixed(2)}:1
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${x(o.v)}%`, background: o.dim ? '#a8a29e' : '#0f766e' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Ceiling marker */}
      <div className="relative h-6 mt-1">
        <div
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#4a2040]"
          style={{ left: `${x(ceiling)}%` }}
        />
        <span
          className="absolute top-1 text-[10px] text-[#4a2040] font-medium whitespace-nowrap"
          style={{ left: `${x(ceiling)}%`, transform: 'translateX(-100%)', paddingRight: 6 }}
        >
          Ceiling of research-based effect · {ceiling.toFixed(2)}:1
        </span>
      </div>
    </div>
  );
}
