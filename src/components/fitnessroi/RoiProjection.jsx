import React from 'react';
import RoiRampChart from '@/components/fitnessroi/RoiRampChart';
import { STAGES } from '@/lib/roiModel';

export default function RoiProjection({ roiResult, stageNum, onStageChange }) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const stage = STAGES[stageNum - 1];
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-4">Your projected ROI with SkillfulMeans</h2>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Annual Savings</p>
          <p className="text-xl font-bold text-[#0f766e]">{fmt(roiResult.annualSavings)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Net ROI</p>
          <p className="text-xl font-bold text-[#0f766e]">{Math.round(roiResult.netROI)}%</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Payback</p>
          <p className="text-xl font-bold text-[#0f766e]">{roiResult.paybackMonths} mo</p>
        </div>
      </div>
      <RoiRampChart drivers={roiResult.drivers} />
      <div className="mt-5 pt-4 border-t border-stone-100">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Investment Breakdown</p>
        <div className="space-y-1">
          {roiResult.investmentBreakdown.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-stone-600">{item.label}</span>
              <span className="text-stone-700 font-medium">{fmt(item.cost)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-stone-100 mt-1">
            <span className="text-[#4a2040]">Total Investment</span>
            <span className="text-[#4a2040]">{fmt(roiResult.investment)}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-stone-100">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs uppercase tracking-widest text-stone-400">Campaign Stage</p>
          <span className="text-sm font-semibold text-[#4a2040]">Stage {stage.num}: {stage.name}</span>
        </div>
        <input type="range" min="1" max="6" step="1" value={stageNum}
          onChange={e => onStageChange(parseInt(e.target.value))}
          className="w-full accent-[#0f766e]" />
        <div className="flex justify-between text-[10px] text-stone-400 mt-1">
          {STAGES.map(s => <span key={s.num}>{s.num}</span>)}
        </div>
        {stageNum === 2 && <p className="text-xs text-[#0f766e] mt-1 font-medium">Habit — recommended</p>}
      </div>
    </div>
  );
}