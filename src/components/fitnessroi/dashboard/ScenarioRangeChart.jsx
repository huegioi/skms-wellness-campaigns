import React from 'react';

/**
 * Internal scenario range — all four cases, ascending by effect size.
 *
 * Conservative is shown here and nowhere else. Expected is drawn outlined
 * because it is the only case that varies DELIVERY rather than effect size:
 * same Base Case coefficients, every design condition met, reach held through
 * year three, and capacity bought to match — which is why its investment is
 * higher than the others. From a low starting participation it can outrank
 * Optimistic, and that is the point.
 */
const fmtUSD = (v) => '$' + Math.round(v).toLocaleString();

const FILL = {
  conservative: '#a8a29e',
  base: '#0f766e',
  expected: 'rgba(74,32,64,0.10)',
  optimistic: '#14b8a6',
};

export default function ScenarioRangeChart({ scenarios, headcount = 0 }) {
  const rows = scenarios?.all || [];
  if (!rows.length) return null;

  const max = Math.max(...rows.map(r => r.annualSavings)) || 1;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#4a2040]">Scenario range</h3>
        <span className="text-[10px] text-stone-400">ascending by effect size</span>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed mb-4">
        Expected holds Base Case effect sizes and varies delivery only — the four no-cost conditions met,
        reach sustained, capacity purchased to match — which is why it is outlined and why its investment
        is higher. Conservative is internal only; clients see Base Case, Expected and Optimistic.
      </p>

      <div className="space-y-3">
        {rows.map((r) => {
          const pct = Math.max(2, (r.annualSavings / max) * 100);
          const outlined = r.scenario === 'expected';
          const reached = headcount ? Math.round(headcount * r.reach) : null;
          return (
            <div key={r.scenario}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs font-semibold text-[#4a2040]">
                  {r.label}
                  {!r.clientFacing && (
                    <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider text-stone-400">
                      internal
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-stone-400 tabular-nums shrink-0">
                  {Math.round(r.reach * 100)}% reach
                  {reached != null && ` · ${reached.toLocaleString()} people`}
                  {' · '}{fmtUSD(r.investment)} invested
                  {' · '}<b className="text-stone-600">{r.perDollar.toFixed(2)}:1</b>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: FILL[r.scenario],
                      border: outlined ? '1.5px dashed #4a2040' : 'none',
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-[#4a2040] tabular-nums w-24 text-right shrink-0">
                  {fmtUSD(r.annualSavings)}
                </span>
              </div>
              {r.overCapacity && (
                <p className="text-[10px] text-[#b45309] mt-1">
                  ⚠ credits savings for more people than the rate card pays to serve
                  ({Math.round(r.pricedCapacity * 100)}% priced capacity)
                </p>
              )}
              {r.exceedsCeiling && (
                <p className="text-[10px] text-[#b45309] mt-1">
                  ⚠ above the ceiling of research-based effect — check the coefficients
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
