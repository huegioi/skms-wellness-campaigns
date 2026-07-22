import React, { useState, useMemo } from 'react';
import { runRoi, STAGES } from '@/lib/roiModel';
import SavingsChart from '@/components/fitnessroi/dashboard/SavingsChart';

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

const DRIVER_KEYS = ['medical', 'absenteeism', 'presenteeism', 'turnover', 'workersComp'];
const GAP_THRESHOLD = 5;

const COLOR_A = '#a8a29e'; // stone-400 — estimate
const COLOR_B = '#0f766e'; // brand teal — real data

function domainDisplay(domainKey, score) {
  if (domainKey === 'pss4') {
    return { value: Math.round(100 - score), suffix: '% high stress' };
  }
  return { value: Math.round(score), suffix: '' };
}

// Nice-step ceiling: headroom never exceeds ~15% above the tallest bar
function niceMax(rawMax) {
  if (rawMax <= 0) return 100;
  let step = Math.pow(10, Math.floor(Math.log10(rawMax / 5)));
  let niceMaxVal = Math.ceil(rawMax / step) * step;
  // Halve the step until headroom is within 15%
  while (niceMaxVal > rawMax * 1.15 && step > 1) {
    step /= 2;
    niceMaxVal = Math.ceil(rawMax / step) * step;
  }
  return niceMaxVal;
}

export default function RoiComparison({ preliminaryRoi, teamRoi, roiInputs, stressRateReal, leaderScores, teamScores }) {
  const [stageNum, setStageNum] = useState(roiInputs?.stageNum || 2);

  const reactiveRoi = useMemo(() => {
    if (!roiInputs) return teamRoi;
    return runRoi({ ...roiInputs, stressRate: stressRateReal, stageNum });
  }, [roiInputs, stressRateReal, stageNum, teamRoi]);

  // Locked y-axis max — computed once across both charts and all stages
  const globalMax = useMemo(() => {
    let max = 0;
    if (preliminaryRoi?.drivers) {
      for (const k of DRIVER_KEYS) max = Math.max(max, preliminaryRoi.drivers[k] || 0);
    }
    if (roiInputs) {
      for (const s of STAGES) {
        const r = runRoi({ ...roiInputs, stressRate: stressRateReal, stageNum: s.num });
        for (const k of DRIVER_KEYS) max = Math.max(max, r.drivers[k] || 0);
      }
    }
    return niceMax(max);
  }, [preliminaryRoi, roiInputs, stressRateReal]);

  const stage = STAGES[stageNum - 1];

  const { gaps, closeDomains } = useMemo(() => {
    const gaps = [];
    const closeDomains = [];
    for (const d of DOMAINS) {
      const est = leaderScores?.[d.key];
      const real = teamScores?.[d.key];
      if (est == null || real == null) continue;
      const estDisp = domainDisplay(d.key, est);
      const realDisp = domainDisplay(d.key, real);
      const delta = realDisp.value - estDisp.value;
      if (Math.abs(delta) >= GAP_THRESHOLD) {
        const teamWorse = d.key === 'pss4' ? delta > 0 : delta < 0;
        gaps.push({ domain: d, estDisp, realDisp, delta, teamWorse });
      } else {
        closeDomains.push(d.label);
      }
    }
    return { gaps, closeDomains };
  }, [leaderScores, teamScores]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-4">Your ROI, re-run on real data</h2>

      {/* ── Gap comparison — aligned grid ── */}
      <div className="bg-red-50/60 rounded-xl p-4 mb-6 border border-red-100">
        <p className="text-xs uppercase tracking-widest text-red-700/70 font-semibold mb-3">
          Where your read diverged from your team's
        </p>
        {gaps.length > 0 ? (
          <div className="space-y-2">
            {gaps.map((g) => (
              <div
                key={g.domain.key}
                className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-3 text-sm"
              >
                <span className="font-semibold text-stone-700">{g.domain.label}</span>
                <span className="text-stone-500">
                  You estimated: <span className="font-medium text-stone-700">{g.estDisp.value}{g.estDisp.suffix}</span>
                </span>
                <span className="text-stone-500">
                  Your team reports: <span className="font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{g.realDisp.value}{g.realDisp.suffix}</span>
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    g.teamWorse ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {g.delta > 0 ? '+' : ''}
                  {g.delta} pts
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            Your estimates closely matched your team's reality across all domains.
          </p>
        )}
        {closeDomains.length > 0 && (
          <p className="text-xs text-stone-400 mt-3">Close to your estimate: {closeDomains.join(', ')}.</p>
        )}
      </div>

      {/* ── Two charts — equal columns, same locked y-scale ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
        <div>
          <p className="text-xs font-semibold text-stone-500 mb-2 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_A }} />
            Projected savings — based on your estimate
          </p>
          {preliminaryRoi?.drivers && (
            <SavingsChart drivers={preliminaryRoi.drivers} globalMax={globalMax} barColor={COLOR_A} />
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-[#0f766e] mb-2 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_B }} />
            Projected savings — based on your team's real data
          </p>
          {reactiveRoi?.drivers && (
            <SavingsChart drivers={reactiveRoi.drivers} globalMax={globalMax} barColor={COLOR_B} />
          )}
        </div>
      </div>

      {/* ── Full-width slider panel ── */}
      <div className="mt-4 bg-teal-50/50 rounded-xl p-4 border border-teal-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-stone-400">Program stage</p>
            <span className="text-[10px] text-[#0f766e] bg-teal-100 px-2 py-0.5 rounded-full font-medium">
              controls the right chart →
            </span>
          </div>
          <span className="text-sm font-semibold text-[#0f766e]">
            Program stage: {stage.num} — {stage.name}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={stageNum}
          onChange={(e) => setStageNum(parseInt(e.target.value))}
          className="w-full accent-[#0f766e] cursor-pointer"
          style={{ height: '10px' }}
        />
        <div className="flex justify-between text-[10px] text-stone-400 mt-1">
          {STAGES.map((s) => (
            <span key={s.num} className={s.num === stageNum ? 'font-bold text-[#0f766e]' : ''}>
              {s.num}
            </span>
          ))}
        </div>
        <p className="text-xs text-stone-500 mt-3">{STAGE_SUMMARY[stage.num]}</p>
        <p className="text-[10px] text-stone-400 italic mt-1">
          Only the teal chart updates — your original estimate stays fixed for comparison.
        </p>
      </div>
    </div>
  );
}