import React, { useEffect, useMemo, useState } from 'react';
import StepNavigation from './StepNavigation';
import { Check, Gift } from 'lucide-react';
import {
  runScenarios,
  runScenario,
  participationFrom,
  RESEARCH_MODEL,
  STAGES,
} from '@/lib/roiModel';
import { computeQuote } from '@/lib/rateCard';
import { DRIVERS } from '@/components/fitnessroi/dashboard/SavingsChart';

/**
 * Impact step — the ROI of the campaign, made palpable before any product is
 * chosen. Designed for a quick call: labels and numbers only, evidence behind
 * per-toggle "research" expanders.
 *
 * CLIENT-SAFE BY CONSTRUCTION. Only the three client-facing scenarios render
 * (scenarios.clientFacing); the Conservative floor and capacity warnings stay
 * on the internal ROI Test Bed. All math comes from journeyModel.ts and all
 * prices from rateCard.ts — nothing here defines a coefficient or a dollar.
 */

const EVIDENCE = {
  optOut: {
    label: 'Enrolled by default',
    why: 'The largest single lever in the literature and the cheapest. Madrian & Shea 2001 (QJE): 401(k) participation went 37% → 86% on the default alone. Richter 2023 (JAMA Intern Med, n=1,000) is the health analogue: 60% vs 34% uptake. Discounted hard because no RCT has tested opt-out in workplace wellness specifically.',
  },
  workday: {
    label: 'During work hours',
    why: 'Jørgensen 2016 (BMJ Open, n=10,605, nationally representative): programs offered only in leisure time carried OR 0.70 against participation — this multiplier is the inverse. Every one of six program types tested was significantly lower when moved off paid time.',
  },
  noCost: {
    label: 'Free for employees',
    why: 'Halpern 2015 (NEJM, n=2,538): a reward-framed program drew 90.0% enrollment; an economically equivalent one requiring a $150 refundable deposit drew 13.7%. Discounted heavily because SkillfulMeans campaigns are employer-paid by default — switch off only if a client passes cost to staff.',
  },
  teamLeader: {
    label: 'Teams + leaders in',
    why: 'Kullgren 2013 (Annals): identical dollars produced 4.8kg vs 1.7kg weight loss when the incentive was group-based. Patel 2016 (JGIM): hybrid individual+team designs beat control while pure team goals failed. Leader sponsorship is real but the weakest-quantified item in the evidence base — kept modest for that reason.',
  },
};

const SCENARIO_FILL = { base: '#C39CB4', expected: '#8E5379', optimistic: '#52223F' };
const usd = (n) => '$' + Math.round(n).toLocaleString();
const pct1 = (n) => (n * 100).toFixed(1) + '%';

const DEFAULT_ASSUMPTIONS = { avgSalary: 75000, stressRate: 35, turnoverRate: 15, absDays: 4.2 };

// Starting position for a fresh session: the three conditions that cost the
// client nothing (opt-out enrollment, workday scheduling, employer-paid) are
// on; team+leader enrollment — the one real ask — starts off.
const DEFAULT_CONDITIONS = { optOut: true, workday: true, noCost: true };

export default function ImpactStep({ selections, updateSelections, onNext, onBack, onStageChange }) {
  const saved = selections.impact || {};
  const [conditions, setConditions] = useState(saved.conditions || DEFAULT_CONDITIONS);
  const [stageNum, setStageNum] = useState(saved.stageNum || 3);
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS, ...(saved.assumptions || {}) });

  const headcount = parseInt(selections.assessmentData?.companySize || '0', 10) || 0;
  const N = headcount > 0 ? headcount : 500;

  const participRate = useMemo(() => participationFrom(conditions), [conditions]);

  const inputs = useMemo(() => ({
    employees: N,
    avgSalary: Number(assumptions.avgSalary) || 0,
    stressRate: (Number(assumptions.stressRate) || 0) / 100,
    turnoverRate: (Number(assumptions.turnoverRate) || 0) / 100,
    absDays: Number(assumptions.absDays) || 0,
    participRate,
    stageNum,
    // Expected/Optimistic follow the commitments chosen here, so every bar
    // and stage card reacts to the toggles.
    conditions,
  }), [N, assumptions, participRate, stageNum, conditions]);

  const scenarios = useMemo(() => runScenarios(inputs), [inputs]);
  const base = scenarios.byKey.base;

  // Persist everything this step decided so Review (and a returning visit to
  // this step) can read it back.
  useEffect(() => {
    updateSelections('impact', { conditions, stageNum, assumptions, participRate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, stageNum, assumptions, participRate]);

  const setHeadcount = (val) => {
    updateSelections('assessmentData', { ...(selections.assessmentData || {}), companySize: val });
  };

  const pickStage = (st) => {
    setStageNum(st.num);
    if (onStageChange) onStageChange(`Stage ${st.num} — ${st.name}`);
  };

  const toggle = (key) => setConditions((c) => ({ ...c, [key]: !c[key] }));

  // What each toggle is worth in Base-Case dollars: the savings gained by
  // switching it on from here (off), or currently contributed by it (on).
  const deltaFor = (key) => {
    const flipped = { ...conditions, [key]: !conditions[key] };
    const other = runScenario({ ...inputs, participRate: participationFrom(flipped), conditions: flipped }, 'base');
    return Math.abs(base.annualSavings - other.annualSavings);
  };

  // Bars compare 3-YEAR totals: with Expected running at the same chosen
  // participation as Base, year one is identical by construction — the
  // difference between them is reach held through years two and three.
  const clientRows = scenarios.clientFacing.slice().sort((a, b) => a.yearProjection.total3yr - b.yearProjection.total3yr);

  // FIXED yardstick: bars are scaled against the best achievable outcome
  // (every condition met), not against the current largest bar. Relative
  // scaling made bars visually SHRINK as toggles were added — the top bar
  // always filled the row, so a rising Base lost share of a rising max.
  // Against a fixed ceiling, every added commitment grows every bar.
  const fullOptimistic = useMemo(
    () => runScenario({ ...inputs, conditions: undefined }, 'optimistic'),
    [inputs],
  );
  const maxSavings = Math.max(
    fullOptimistic.yearProjection.total3yr,
    ...clientRows.map((r) => r.yearProjection.total3yr),
  ) || 1;

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 focus:border-[#013f7c] focus:outline-none bg-white';
  const labelCls = 'block text-[10.5px] font-bold uppercase tracking-widest text-gray-500 mb-1';

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
          See the Impact
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
        {/* ── Left: numbers + participation ── */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Your numbers</h3>
            <label className={labelCls}>Employees</label>
            <input
              type="number"
              min="1"
              className={inputCls}
              value={selections.assessmentData?.companySize || ''}
              placeholder="e.g. 500"
              onChange={(e) => setHeadcount(e.target.value)}
            />
            <details className="mt-3 pt-3 border-t border-gray-100">
              <summary className="cursor-pointer text-sm font-semibold" style={{ color: '#013f7c' }}>
                Adjust to your company
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelCls}>Average salary</label>
                  <input type="number" step="1000" className={inputCls} value={assumptions.avgSalary}
                    onChange={(e) => setAssumptions((a) => ({ ...a, avgSalary: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Reported distress %</label>
                  <input type="number" className={inputCls} value={assumptions.stressRate}
                    onChange={(e) => setAssumptions((a) => ({ ...a, stressRate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Annual turnover %</label>
                  <input type="number" className={inputCls} value={assumptions.turnoverRate}
                    onChange={(e) => setAssumptions((a) => ({ ...a, turnoverRate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Absence days / employee</label>
                  <input type="number" step="0.1" className={inputCls} value={assumptions.absDays}
                    onChange={(e) => setAssumptions((a) => ({ ...a, absDays: e.target.value }))} />
                </div>
              </div>
            </details>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Participation</h3>
            <div className="space-y-2">
              {Object.entries(EVIDENCE).map(([key, ev]) => {
                const on = !!conditions[key];
                const delta = deltaFor(key);
                return (
                  <div
                    key={key}
                    onClick={(e) => { if (!e.target.closest('details')) toggle(key); }}
                    className={`rounded-xl border px-3.5 py-3 cursor-pointer transition-colors ${
                      on ? 'border-[#013f7c] bg-[#013f7c]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        on ? 'bg-[#013f7c] border-[#013f7c]' : 'border-gray-300'
                      }`}>
                        {on && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-gray-800">{ev.label}</span>
                      {delta > 0 && (
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: on ? '#264d44' : '#8a8478' }}>
                          {on ? '+' : ''}{usd(delta)}/yr
                        </span>
                      )}
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ color: '#770142', background: 'rgba(119,1,66,0.07)' }}>
                        ×{RESEARCH_MODEL.participation.or[key].toFixed(2)}
                      </span>
                    </div>
                    <details className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <summary className="text-[11px] text-gray-400 cursor-pointer">ⓘ research</summary>
                      <p className="text-[11.5px] text-gray-600 leading-relaxed mt-1.5 px-3 py-2 rounded-lg bg-[#faf8f3] border-l-2" style={{ borderColor: '#cae5e3' }}>
                        {ev.why}
                      </p>
                    </details>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-gray-400 mt-3 px-3 py-2 rounded-lg bg-[#faf8f3] flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 flex-shrink-0" />
              Wellness box raffle — always included <b>×{RESEARCH_MODEL.participation.or.raffle.toFixed(2)}</b>
            </p>
            <div className="flex items-baseline justify-between border-t border-gray-100 pt-3 mt-3">
              <span className="text-[10.5px] uppercase tracking-widest text-gray-500 font-bold">Modelled participation</span>
              <span className="text-3xl font-extrabold tabular-nums" style={{ color: '#013f7c' }}>{pct1(participRate)}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {Math.round(N * participRate).toLocaleString()} of {N.toLocaleString()} employees
            </p>
          </div>
        </div>

        {/* ── Right: savings + drivers ── */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Projected savings</h3>
              <span className="text-[10px] text-gray-400">
                3-year total · full width = all four conditions met ({usd(maxSavings)})
              </span>
            </div>
            <div className="space-y-4">
              {clientRows.map((r) => (
                <div key={r.scenario}>
                  <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: '#441d37' }}>
                      {r.label}
                      {r.capacityBought && (
                        <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#770142', background: '#f4f0e9' }}>
                          capacity bought
                        </span>
                      )}
                      {r.bounded && (
                        <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#B4531F', background: '#fdf0e7' }}>
                          at published ceiling
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-gray-400 tabular-nums">
                      {Math.round(r.reach * 100)}% reach · {usd(r.investment)} invested · <b className="text-gray-600">{usd(r.annualSavings)}/yr</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(68,29,55,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(2, (r.yearProjection.total3yr / maxSavings) * 100)}%`, background: SCENARIO_FILL[r.scenario] }} />
                    </div>
                    <span className="text-sm font-extrabold tabular-nums w-24 text-right" style={{ color: '#441d37' }}>
                      {usd(r.yearProjection.total3yr)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Where the money comes from</h3>
            <div className="space-y-1.5">
              {DRIVERS.map((d) => {
                const v = base.drivers[d.key] || 0;
                const share = base.annualSavings > 0 ? v / base.annualSavings : 0;
                return (
                  <div key={d.key} className="flex items-center gap-2.5 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-600 flex-1">{d.label}</span>
                    <span className="text-[11px] text-gray-400 tabular-nums">{Math.round(share * 100)}%</span>
                    <span className="font-bold text-gray-800 tabular-nums w-20 text-right">{usd(v)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm font-extrabold pt-2 mt-1 border-t border-gray-100" style={{ color: '#013f7c' }}>
                <span>Annual savings</span>
                <span className="tabular-nums">{usd(base.annualSavings)}</span>
              </div>
            </div>
            <div className="flex gap-2.5 mt-4">
              {[
                ['Year 1', base.yearProjection.y1],
                ['Year 2', base.yearProjection.y2],
                ['Year 3', base.yearProjection.y3],
                ['3-yr total', base.yearProjection.total3yr],
              ].map(([label, val]) => (
                <div key={label} className="flex-1 rounded-xl px-3 py-2.5 text-center bg-[#faf8f3]">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
                  <div className="text-[15px] font-extrabold tabular-nums mt-0.5" style={{ color: '#441d37' }}>{usd(val)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stages ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4">Choose your stage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STAGES.map((st) => {
            const q = computeQuote({ headcount: N, stage: st.num });
            const s = runScenario({ ...inputs, stageNum: st.num }, 'base');
            const e = runScenario({ ...inputs, stageNum: st.num }, 'expected');
            const selected = st.num === stageNum;
            const bits = [
              `${st.workshops} workshops`,
              `${st.challenges} challenge${st.challenges !== 1 ? 's' : ''}`,
              ...(st.leq ? ['Leadership EQ'] : []),
              ...(st.groupCoaching ? ['group coaching'] : []),
              ...(st.indivCoaching ? ['1:1 coaching'] : []),
            ].join(' · ');
            return (
              <button
                key={st.num}
                type="button"
                onClick={() => pickStage(st)}
                aria-pressed={selected}
                className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                  selected ? 'border-[#013f7c] bg-[#013f7c]/5 shadow-md' : 'border-gray-200 bg-white hover:border-[#013f7c]/40'
                }`}
              >
                {st.num >= 4 && (
                  <span className="absolute -top-2 right-3 text-[8.5px] font-extrabold px-2 py-0.5 rounded-lg tracking-wide" style={{ background: '#eaf995', color: '#264d44' }}>
                    BY CONVERSATION
                  </span>
                )}
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400">Stage {st.num}</div>
                <div className="text-base font-extrabold" style={{ color: '#013f7c' }}>{st.name}</div>
                <div className="text-[10.5px] text-gray-400 leading-snug mb-2">{bits}</div>
                <div className="text-sm font-extrabold text-gray-800 tabular-nums">
                  {usd(q.total)} <span className="text-[10px] font-normal text-gray-400">/ campaign</span>
                </div>
                <div className="border-t border-gray-100 mt-2 pt-1.5">
                  <div className="text-[8.5px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">ROI in money saved · 3 years</div>
                  <div className="flex justify-between text-[11px] text-gray-600 tabular-nums">
                    <span>Base <b style={{ color: '#770142' }}>{usd(s.yearProjection.total3yr)}</b></span>
                    <span>Run well <b style={{ color: '#770142' }}>{usd(e.yearProjection.total3yr)}</b></span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <StepNavigation onNext={onNext} onBack={onBack} nextLabel="Continue to Workshops" />
    </div>
  );
}
