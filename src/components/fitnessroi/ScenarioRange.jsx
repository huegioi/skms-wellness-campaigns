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

const FILL = {
  base: '#0f766e',
  optimistic: '#14b8a6',
  expected: 'transparent',
};

export default function ScenarioRange({ scenarios, showInvestment = false }) {
  const eligible = scenarios?.clientFacing || [];
  // A scenario above the ceiling of research-based effect has no published
  // support, so it does not go in front of a buyer. This happens in real cases
  // -- a high measured distress rate can push Optimistic over 6.3:1 -- and
  // quietly capping it would be the same dishonesty the soft cap was removed
  // for. We drop it and say we dropped it.
  const withheld = eligible.filter(s => s.exceedsCeiling);
  const rows = eligible
    .filter(s => !s.exceedsCeiling)
    .slice()
    .sort((a, b) => a.annualSavings - b.annualSavings);
  if (!rows.length) return null;

  const max = Math.max(...rows.map(r => r.annualSavings)) || 1;
  const byKey = Object.fromEntries(rows.map(r => [r.scenario, r]));

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#4a2040] mb-1">Three numbers, not one</h3>
      <p className="text-xs text-stone-500 leading-relaxed mb-4">
        Most wellbeing programmes are sold with a single confident figure. We&rsquo;d rather show you what
        we&rsquo;d plan against, what we&rsquo;d expect, and where the ceiling sits.
      </p>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = Math.max(3, (r.annualSavings / max) * 100);
          const outlined = r.scenario === 'expected';
          return (
            <div key={r.scenario}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-[#4a2040]">
                  {r.label}
                  {outlined && (
                    <span className="ml-1.5 font-normal text-[10px] text-stone-400">
                      with every commitment in place
                    </span>
                  )}
                </span>
                <span className="text-xs font-bold text-[#0f766e] tabular-nums">
                  {fmtUSD(r.annualSavings)}
                  {showInvestment && (
                    <span className="ml-1.5 font-normal text-stone-400">
                      on {fmtUSD(r.investment)}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: FILL[r.scenario] || '#0f766e',
                    border: outlined ? '1.5px dashed #4a2040' : 'none',
                    backgroundColor: outlined ? 'rgba(74,32,64,0.08)' : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {withheld.length > 0 && (
        <p className="text-xs text-stone-500 leading-relaxed mt-4">
          There is a more optimistic case, and we&rsquo;ve left it out. At your numbers it lands above
          anything published for a programme run across a whole workforce, so we don&rsquo;t think
          it&rsquo;s a number you should plan around.
        </p>
      )}

      {byKey.base && byKey.expected && (
        <p className="text-xs text-stone-500 leading-relaxed mt-4">
          <b className="text-stone-700">{fmtUSD(byKey.base.annualSavings)}</b> is the number we&rsquo;d
          hold ourselves to.{' '}
          <b className="text-stone-700">{fmtUSD(byKey.expected.annualSavings)}</b> is what we&rsquo;d
          expect with all four commitments in place.
          {byKey.optimistic && (
            <>
              {' '}<b className="text-stone-700">{fmtUSD(byKey.optimistic.annualSavings)}</b> is the work
              landing about as well as it does anywhere.
            </>
          )}
        </p>
      )}

      <p className="text-xs text-stone-500 leading-relaxed mt-3">
        All three move with the choices above — those decide how many of your people the programme
        actually reaches, and reach decides everything after it.
      </p>
    </div>
  );
}
