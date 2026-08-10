import React from 'react';

/**
 * Internal scenario range — all four cases, ascending.
 *
 * Each step changes exactly one more thing than the step below it, so the
 * ladder is strictly increasing and the labels mean what they say:
 *
 *   Conservative  floor effects,  client's participation   (internal only)
 *   Base Case     mid effects,    client's participation
 *   Expected      mid effects,    every condition met + capacity bought
 *   Optimistic    upper effects,  every condition met + capacity bought
 *
 * Conservative is shown here and nowhere else.
 */
const fmtUSD = (v) => '$' + Math.round(v).toLocaleString();

const FILL = {
  conservative: '#a8a29e',
  base: '#0f766e',
  expected: '#14b8a6',
  optimistic: '#4a2040',
};

export default function ScenarioRangeChart({ scenarios, headcount = 0 }) {
  const rows = (scenarios?.all || []).slice().sort((a, b) => a.annualSavings - b.annualSavings);
  if (!rows.length) return null;

  const max = Math.max(...rows.map(r => r.annualSavings)) || 1;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#4a2040]">Scenario range</h3>
        <span className="text-[10px] text-stone-400">ascending</span>
      </div>
      <p className="text-xs text-stone-500 leading-relaxed mb-4">
        Each step changes one more thing than the step below it. <b>Expected</b> holds Base Case effect
        sizes and varies delivery — the four no-cost conditions met, reach sustained, capacity purchased
        to match, which is why its investment is higher. <b>Optimistic</b> is that same delivery with
        upper-range effect sizes, so it is the top of the range by construction. Conservative is internal
        only; clients see Base Case, Expected and Optimistic.
      </p>

      <div className="space-y-3">
        {rows.map((r) => {
          const pct = Math.max(2, (r.annualSavings / max) * 100);
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
                  {r.capacityBought && (
                    <span className="ml-1.5 text-[10px] font-normal text-[#0f766e] bg-teal-50 px-1.5 py-0.5 rounded-full">
                      capacity bought
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
                    style={{ width: `${pct}%`, background: FILL[r.scenario] }}
                  />
                </div>
                <span className="text-xs font-bold text-[#4a2040] tabular-nums w-24 text-right shrink-0">
                  {fmtUSD(r.annualSavings)}
                </span>
              </div>
              {r.exceedsCeiling && (
                <p className="text-[10px] text-[#b45309] mt-1">
                  ⚠ above the ceiling of research-based effect — withheld from the client view
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* One capacity note for the whole group — every non-Expected scenario
       *  shares the same participation, so it is one fact, not four. */}
      {rows.some(r => r.overCapacity) && (
        <p className="text-[11px] text-[#b45309] mt-3 leading-relaxed">
          ⚠ This stage is priced to serve about{' '}
          {Math.round((rows.find(r => r.overCapacity)?.pricedCapacity || 0) * 100)}% of the workforce.
          Every case except Expected credits savings above that — buy the extra capacity, or quote
          Expected, which prices its own.
        </p>
      )}
    </div>
  );
}
