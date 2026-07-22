import React, { useState, useMemo } from 'react';
import { runRoi, STAGES } from '@/lib/roiModel';
import RoiRampChart from '@/components/fitnessroi/RoiRampChart';

const DOMAINS = [
  { key: 'who5', label: 'Wellbeing' },
  { key: 'pss4', label: 'Stress' },
  { key: 'uwes3', label: 'Engagement' },
  { key: 'ucla3', label: 'Connection' },
];

const STAGE_SUMMARY = {
  1: '2 workshops · 1 challenge',
  2: '4 workshops · 2 challenges',
  3: '2 workshops · 2 challenges · Leader EQ Training',
  4: '4 workshops · 2 challenges · Leader EQ Training',
  5: '4 workshops · 2 challenges · Leader EQ · Group Coaching',
  6: '4 workshops · 4 challenges · Leader EQ · Group · 1:1 Coaching · Consultant',
};

export default function RoiComparison({ preliminaryRoi, teamRoi, roiInputs, stressRateReal, leaderScores, teamScores }) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const [stageNum, setStageNum] = useState(roiInputs?.stageNum || 2);

  // Reactive ROI: re-run with the selected stage and real stress rate
  const reactiveRoi = useMemo(() => {
    if (!roiInputs) return teamRoi;
    return runRoi({ ...roiInputs, stressRate: stressRateReal, stageNum });
  }, [roiInputs, stressRateReal, stageNum, teamRoi]);

  const stage = STAGES[stageNum - 1];

  const StatCol = ({ label, roi, accent }) => (
    <div>
      <p className={`text-xs uppercase tracking-widest mb-3 ${accent ? 'text-[#0f766e]' : 'text-stone-400'}`}>{label}</p>
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-sm"><span className="text-stone-500">Annual Savings</span><span className={`font-bold ${accent ? 'text-[#0f766e]' : 'text-stone-700'}`}>{fmt(roi.annualSavings)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-500">Net ROI</span><span className={`font-bold ${accent ? 'text-[#0f766e]' : 'text-stone-700'}`}>{Math.round(roi.netROI)}%</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-500">Payback</span><span className={`font-bold ${accent ? 'text-[#0f766e]' : 'text-stone-700'}`}>{roi.paybackMonths} mo</span></div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-1">Your ROI, re-run on real data</h2>
      <p className="text-xs text-stone-500 mb-5 leading-relaxed">
        Your estimated stress rate is replaced by what your team actually reported — everything downstream updates from that real number.
      </p>

      {/* Per-domain estimate-vs-reality pairs */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {DOMAINS.map(d => {
          const est = leaderScores?.[d.key];
          const real = teamScores?.[d.key];
          const delta = real != null && est != null ? Math.round(real - est) : null;
          return (
            <div key={d.key} className="bg-stone-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-stone-600 mb-2">{d.label}</p>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide">You estimated</p>
                  <p className="text-lg font-bold text-[#4a2040]">{est != null ? Math.round(est) : '—'}</p>
                </div>
                <div className="text-stone-300 text-sm">vs</div>
                <div className="text-right">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide">Team says</p>
                  <p className="text-lg font-bold text-[#0f766e]">{real != null ? Math.round(real) : '—'}</p>
                </div>
              </div>
              {delta != null && (
                <p className={`text-[10px] font-semibold mt-1 text-right ${delta < 0 ? 'text-amber-600' : delta > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                  {delta > 0 ? '+' : ''}{delta} pt gap
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ROI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-5">
        {preliminaryRoi && <StatCol label="Preliminary" roi={preliminaryRoi} />}
        <StatCol label="Team re-run" roi={reactiveRoi} accent />
      </div>

      {/* Chart with caption */}
      <RoiRampChart drivers={reactiveRoi.drivers} />
      <p className="text-[10px] text-stone-400 italic mt-1 text-center">
        Projected 3-year savings by cost driver, using your team's actual scores
      </p>

      {/* Stage slider */}
      <div className="mt-5 pt-4 border-t border-stone-100">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs uppercase tracking-widest text-stone-400">Campaign Stage</p>
          <span className="text-sm font-semibold text-[#4a2040]">Stage {stage.num}: {stage.name}</span>
        </div>
        <p className="text-xs text-stone-500 mb-3">{STAGE_SUMMARY[stage.num]}</p>
        <input type="range" min="1" max="6" step="1" value={stageNum}
          onChange={e => setStageNum(parseInt(e.target.value))}
          className="w-full accent-[#0f766e] cursor-pointer" style={{ height: '10px' }} />
        <div className="flex justify-between text-[10px] text-stone-400 mt-1">
          {STAGES.map(s => <span key={s.num} className={s.num === stageNum ? 'font-bold text-[#0f766e]' : ''}>{s.num}</span>)}
        </div>
        <p className="text-xs text-stone-400 mt-2 italic">Slide to compare program stages — investment and ROI update live.</p>
      </div>

      {/* Investment breakdown */}
      <div className="mt-5 pt-4 border-t border-stone-100">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Investment Breakdown</p>
        <div className="space-y-2">
          {reactiveRoi.investmentBreakdown.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-stone-600">{item.label}</span>
              <span className="text-stone-700 font-medium">{fmt(item.cost)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-stone-100 mt-1">
            <span className="text-[#4a2040]">Total Investment</span>
            <span className="text-[#4a2040]">{fmt(reactiveRoi.investment)}</span>
          </div>
        </div>
        <p className="text-[10px] text-stone-400 italic mt-2 text-center">
          Program cost by component at Stage {stageNum} — {stage.name}
        </p>
      </div>
    </div>
  );
}