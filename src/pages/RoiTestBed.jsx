import React, { useState, useMemo } from 'react';
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs';
import ScenarioRangeChart from '@/components/fitnessroi/dashboard/ScenarioRangeChart';
import { DRIVERS } from '@/components/fitnessroi/dashboard/SavingsChart';
import {
  runScenarios, participationFrom, participationAtFullDelivery,
  deliveryAt, pricedCapacity, STAGES, RESEARCH_MODEL,
} from '@/lib/roiModel';

/**
 * ROI Test Bed — internal.
 *
 * This page imports the model DIRECTLY from base44/shared/journeyModel.ts. It
 * holds no coefficients, no prices and no copy of the maths. Whatever the
 * Journey and the team dashboard would produce for a given set of inputs, this
 * produces too, because it is the same code — there is nothing to keep in sync
 * and nothing that can drift.
 *
 * That is the point of it: somewhere to change an input and watch every number
 * move, including the ones clients never see (Conservative, the unbounded
 * figure behind a bounded one, the capacity flags).
 *
 * INTERNAL ONLY. It shows the Conservative floor and the raw coefficients. Do
 * not link it from anything client-facing.
 */

const COMMITMENTS = [
  ['optOut', 'Everyone enrolled, can step out'],
  ['workday', 'Sessions during work hours'],
  ['noCost', 'Nothing charged to the employee'],
  ['teamLeader', 'Teams together, leaders included'],
];

const usd = (n) => '$' + Math.round(n).toLocaleString();
const pct = (n) => (n * 100).toFixed(1) + '%';

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-800 focus:border-[#013f7c] focus:outline-none';

export default function RoiTestBed() {
  const [employees, setEmployees] = useState(1000);
  const [avgSalary, setAvgSalary] = useState(75000);
  const [stressRate, setStressRate] = useState(35);
  const [turnoverRate, setTurnoverRate] = useState(15);
  const [absDays, setAbsDays] = useState(4.2);
  const [stageNum, setStageNum] = useState(3);
  const [conditions, setConditions] = useState({});

  const participRate = useMemo(() => participationFrom(conditions), [conditions]);

  const inputs = useMemo(() => ({
    employees: Number(employees) || 0,
    avgSalary: Number(avgSalary) || 0,
    stressRate: (Number(stressRate) || 0) / 100,
    turnoverRate: (Number(turnoverRate) || 0) / 100,
    absDays: Number(absDays) || 0,
    participRate,
    stageNum,
  }), [employees, avgSalary, stressRate, turnoverRate, absDays, participRate, stageNum]);

  const scenarios = useMemo(() => runScenarios(inputs), [inputs]);
  const stage = STAGES[stageNum - 1];
  const delivery = useMemo(
    () => deliveryAt(stage, inputs.employees, participRate),
    [stage, inputs.employees, participRate],
  );
  const capacity = useMemo(
    () => pricedCapacity(stage, inputs.employees),
    [stage, inputs.employees],
  );
  const base = scenarios.byKey.base;

  const toggle = (k) => setConditions(c => ({ ...c, [k]: !c[k] }));
  const chosen = Object.values(conditions).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>ROI Test Bed</h1>
          <p className="text-gray-600 mt-1">
            The live model, with nothing hidden. Same code the Journey and the client dashboard run.
          </p>
        </div>

        <AnalyticsTabs current="RoiTestBed" />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Inputs ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700">Workforce</h2>
              <Field label="Employees">
                <input type="number" className={inputCls} value={employees}
                  onChange={e => setEmployees(e.target.value)} />
              </Field>
              <Field label="Average salary">
                <input type="number" step="1000" className={inputCls} value={avgSalary}
                  onChange={e => setAvgSalary(e.target.value)} />
              </Field>
              <Field label="Reported distress %" hint="Share scoring below the PSS-4 threshold">
                <input type="number" className={inputCls} value={stressRate}
                  onChange={e => setStressRate(e.target.value)} />
              </Field>
              <Field label="Annual turnover %">
                <input type="number" className={inputCls} value={turnoverRate}
                  onChange={e => setTurnoverRate(e.target.value)} />
              </Field>
              <Field label="Absence days / employee / year">
                <input type="number" step="0.1" className={inputCls} value={absDays}
                  onChange={e => setAbsDays(e.target.value)} />
              </Field>
              <Field label={`Stage ${stageNum} — ${stage.name}`}>
                <input type="range" min="1" max="6" step="1" value={stageNum}
                  onChange={e => setStageNum(parseInt(e.target.value))}
                  className="w-full accent-[#013f7c]" />
                <p className="text-[11px] text-gray-500 mt-1">
                  {stage.workshops} workshops · {stage.challenges} challenges
                  {stage.leq ? ' · Leader EQ' : ''}{stage.groupCoaching ? ' · Group coaching' : ''}
                  {stage.indivCoaching ? ' · 1:1 coaching' : ''}
                </p>
              </Field>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-1">Design conditions</h2>
              <p className="text-[11px] text-gray-400 mb-3">
                Odds ratios on a {pct(RESEARCH_MODEL.participation.base)} floor. The raffle is standard
                delivery and always applied.
              </p>
              <div className="space-y-1.5">
                {COMMITMENTS.map(([k, label]) => (
                  <button key={k} type="button" onClick={() => toggle(k)}
                    className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      conditions[k] ? 'border-[#013f7c] bg-[#013f7c]/5 text-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <span>{label}</span>
                    <span className="text-[11px] tabular-nums text-gray-400">
                      OR {RESEARCH_MODEL.participation.or[k].toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-widest text-gray-500">Participation</span>
                <span className="text-2xl font-bold text-[#013f7c] tabular-nums">{pct(participRate)}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {chosen} of 4 chosen · floor {pct(participationFrom({}))} · all four {pct(participationAtFullDelivery())}
              </p>
            </div>
          </div>

          {/* ── Outputs ── */}
          <div className="lg:col-span-3 space-y-4">

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <ScenarioRangeChart scenarios={scenarios} headcount={inputs.employees} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-3">
                  Base Case drivers
                </h2>
                <div className="space-y-1.5">
                  {DRIVERS.map(d => {
                    const v = base.drivers[d.key] || 0;
                    const share = base.annualSavings > 0 ? v / base.annualSavings : 0;
                    return (
                      <div key={d.key} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-gray-600 flex-1">{d.label}</span>
                        <span className="text-gray-400 text-[11px] tabular-nums">{(share * 100).toFixed(0)}%</span>
                        <span className="font-semibold text-gray-800 tabular-nums w-20 text-right">{usd(v)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-100">
                    <span className="text-[#013f7c]">Annual savings</span>
                    <span className="text-[#013f7c] tabular-nums">{usd(base.annualSavings)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-3">
                  Delivery at this participation
                </h2>
                <div className="space-y-1.5 text-sm">
                  {[
                    ['People reached', delivery.reached.toLocaleString()],
                    ['Sections per workshop', delivery.sessionsPerTopic],
                    ['Challenge slots', delivery.challengeSlots.toLocaleString()],
                    ['Wellness boxes', delivery.boxes],
                    ['Rate-card price', usd(delivery.pricedCost)],
                    ['Priced capacity', pct(capacity)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-600">{k}</span>
                      <span className="font-semibold text-gray-800 tabular-nums">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-100">
                    <span className="text-[#013f7c]">Capacity-matched cost</span>
                    <span className="text-[#013f7c] tabular-nums">{usd(delivery.cost)}</span>
                  </div>
                </div>
                {delivery.cost > delivery.pricedCost + 1 && (
                  <p className="text-[11px] text-[#B4531F] mt-3 leading-relaxed">
                    Serving {delivery.reached.toLocaleString()} people costs{' '}
                    {usd(delivery.cost - delivery.pricedCost)} more than the rate-card default. Quote the
                    higher figure, or the savings are being credited against a price that does not serve them.
                  </p>
                )}
              </div>
            </div>

            {/* Coefficients — the whole point of a test bed is that these are visible */}
            <details className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <summary className="text-sm font-bold uppercase tracking-widest text-gray-700 cursor-pointer">
                Coefficients in play
              </summary>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
                {[
                  ['Presenteeism loss fraction', RESEARCH_MODEL.costBases.presenteeismLossFraction, 'Stewart 2003 — 7.5% of salary'],
                  ['Replacement cost multiple', RESEARCH_MODEL.costBases.replacementCostMultiple, 'Boushey & Glynn — was 0.75, uncited'],
                  ['Benefit per routed person', RESEARCH_MODEL.costBases.benefitPerRoutedPerson, 'Wang 2007'],
                  ['Route rate', RESEARCH_MODEL.costBases.routeRate, 'Deliberately low — rarely measured'],
                  ['Reach retention, year 2', RESEARCH_MODEL.reachRetention.y2, 'Illinois, gentler'],
                  ['Reach retention, year 3', RESEARCH_MODEL.reachRetention.y3, 'Extrapolated — Robroek 2012'],
                  ['Ceiling', RESEARCH_MODEL.ceiling, 'Deloitte UK universal — a bound, not a target'],
                ].map(([k, v, note]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-gray-50 py-1">
                    <span className="text-gray-600">{k}<span className="block text-[11px] text-gray-400">{note}</span></span>
                    <span className="font-mono text-gray-800 tabular-nums shrink-0">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-4">
                Every coefficient, with its full citation and the reason it was discounted, lives in
                <span className="font-mono"> base44/shared/journeyModel.ts → RESEARCH_MODEL</span>. Change
                it there and this page, the Journey, the dashboard and the outreach drafter all move together.
              </p>
            </details>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700 mb-3">
                Against published benchmarks
              </h2>
              <div className="space-y-1">
                {scenarios.benchmarks.map((b, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-[13px] py-0.5">
                    <span className="text-gray-600">{b.label}</span>
                    <span className="text-gray-400 tabular-nums shrink-0">{b.v.toFixed(2)}:1</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 text-[13px] pt-2 mt-1 border-t border-gray-100 font-semibold">
                  <span className="text-[#013f7c]">This configuration, Base Case (year one)</span>
                  <span className="text-[#013f7c] tabular-nums shrink-0">{base.year1PerDollar.toFixed(2)}:1</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
