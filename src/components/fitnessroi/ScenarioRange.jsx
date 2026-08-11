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
  // Nothing is withheld any more: the model bounds client-facing figures at
  // the highest published ROI rather than letting them run past it, so every
  // case is safe to show. Where the bound bit, we say so instead of quietly
  // presenting a clamped number as an estimate.
  const rows = eligible.slice().sort((a, b) => a.annualSavings - b.annualSavings);
  if (!rows.length) return null;
  const anyBounded = rows.some(r => r.bounded);
  const allSame = rows.length > 1
    && Math.abs(rows[rows.length - 1].annualSavings - rows[0].annualSavings) < 1;

  const max = Math.max(...rows.map(r => r.annualSavings)) || 1;
  const byKey = Object.fromEntries(rows.map(r => [r.scenario, r]));

  return (
    <div>
      <h3 className="text-sm font-semibold text-mf-plum mb-1">Three numbers, not one</h3>
      <p className="text-xs text-mf-ink-2 leading-relaxed mb-4">
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
              <div className="h-2.5 rounded-full bg-mf-cream overflow-hidden">
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

      {allSame ? (
        <p className="text-xs text-mf-ink-2 leading-relaxed mt-4">
          At your numbers these come out the same, and we&rsquo;d rather show you that than manufacture a
          spread. A workforce this size, with this much reported distress and these salaries, is one
          where the published evidence stops being able to tell the cases apart — so we hold all of them
          to the highest figure anyone has published and plan against the first one.
        </p>
      ) : anyBounded && (
        <p className="text-xs text-mf-ink-2 leading-relaxed mt-4">
          The top of this range is held at the highest return any published study reports for a programme
          run across a whole workforce. Our own maths came out higher. We don&rsquo;t print that number,
          because nobody has demonstrated it.
        </p>
      )}

      {!allSame && byKey.base && byKey.expected && (
        <p className="text-xs text-mf-ink-2 leading-relaxed mt-4">
          <b className="text-mf-ink">{fmtUSD(byKey.base.annualSavings)}</b> is the number we&rsquo;d
          hold ourselves to.{' '}
          <b className="text-mf-ink">{fmtUSD(byKey.expected.annualSavings)}</b> is what we&rsquo;d
          expect with all four commitments in place.
          {byKey.optimistic && (
            <>
              {' '}<b className="text-mf-ink">{fmtUSD(byKey.optimistic.annualSavings)}</b> is the work
              landing about as well as it does anywhere.
            </>
          )}
        </p>
      )}

      <p className="text-xs text-mf-ink-2 leading-relaxed mt-3">
        {rows.length > 2 ? 'All three' : 'Both'} move with the choices above — those decide how many of
        your people the programme actually reaches, and reach decides everything after it.
      </p>
    </div>
  );
}
