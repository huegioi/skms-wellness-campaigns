import React from 'react';

/**
 * Client-facing scenario range: Base Case, Expected, Optimistic.
 *
 * Conservative is deliberately absent — it is the internal floor, shown only on
 * the team dashboard. Bars ascend by value, which is also ascending by effect
 * size except where Expected overtakes Optimistic: from a low starting
 * participation, delivery moves the number more than effect size does. That is
 * a real property of the model, not a display bug, so the bars are sorted by
 * value and Expected is drawn outlined to mark that it varies delivery rather
 * than science.
 */
const fmtUSD = (v) => '$' + Math.round(v).toLocaleString();

// Sequential — one hue, light to dark, because the scenarios are ORDERED.
const FILL = { base: '#C39CB4', expected: '#8E5379', optimistic: '#52223F' };

export default function ScenarioRange({ scenarios, showInvestment = false }) {
  const eligible = scenarios?.clientFacing || [];
  // Nothing is withheld any more: the model bounds client-facing figures at
  // the highest published ROI rather than letting them run past it, so every
  // case is safe to show. The bars carry the numbers on their own — the prose
  // that used to restate them and explain the bound was cut 2026-08-17.
  const rows = eligible.slice().sort((a, b) => a.annualSavings - b.annualSavings);
  if (!rows.length) return null;
  const allSame = rows.length > 1
    && Math.abs(rows[rows.length - 1].annualSavings - rows[0].annualSavings) < 1;

  const max = Math.max(...rows.map(r => r.annualSavings)) || 1;

  return (
    <div>
      <h3 className="mf-serif text-[19px] text-mf-plum mb-1.5">Three numbers, not one</h3>
      <p className="text-xs text-mf-ink-2 leading-relaxed mb-4">
        Most wellbeing programs are sold with a single confident figure. We&rsquo;d rather show you what
        we&rsquo;d plan against, what we&rsquo;d expect, and where the ceiling sits.
      </p>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = Math.max(3, (r.annualSavings / max) * 100);
          const outlined = r.scenario === 'expected';
          return (
            <div key={r.scenario}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-mf-plum">
                  {r.label}
                  {outlined && (
                    <span className="ml-1.5 font-normal text-[10px] text-mf-ink-3">
                      with every commitment in place
                    </span>
                  )}
                </span>
                <span className="text-xs font-bold text-mf-plum tabular-nums">
                  {fmtUSD(r.annualSavings)}
                  {showInvestment && (
                    <span className="ml-1.5 font-normal text-mf-ink-3">
                      on {fmtUSD(r.investment)}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(68,29,55,0.07)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: FILL[r.scenario] || '#8E5379' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* The only note left: three identical bars need explaining, or the chart
          reads as broken. Everything else that sat here — the published-ceiling
          note, the restatement of the three figures, and the "these move with the
          choices above" line — was cut 2026-08-17 at William's request. */}
      {allSame && (
        <p className="text-xs text-mf-ink-2 leading-relaxed mt-4">
          At your numbers these come out the same, and we&rsquo;d rather show you that than manufacture a
          spread. A workforce this size, with this much reported distress and these salaries, is one
          where the published evidence stops being able to tell the cases apart.
        </p>
      )}
    </div>
  );
}
