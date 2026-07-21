import React from 'react';
import RoiRampChart from '@/components/fitnessroi/RoiRampChart';
import EscalationInfographic from '@/components/fitnessroi/EscalationInfographic';
import { STAGES } from '@/lib/roiModel';

const BREAKDOWN_EXPLANATIONS = {
  'Workshops & Webinars': 'Live expert-led sessions on stress, resilience, and mental fitness',
  'Challenges': 'Time-boxed team challenges (e.g. 14-day calm or movement)',
  'Leader EQ Training': 'Equips managers with emotional intelligence and mental health conversation skills',
  'Group Coaching': 'Small-cohort coaching for deeper behavior change',
  'Individual Coaching': '1:1 coaching for high-need employees',
  'Consultant': 'Dedicated wellness consultant embedded with your team',
  'Wellness Boxes': 'Physical wellness products shipped as incentives',
};

const STAGE_SUMMARY = {
  1: '2 workshops · 1 challenge',
  2: '4 workshops · 2 challenges',
  3: '2 workshops · 2 challenges · Leader EQ Training',
  4: '4 workshops · 2 challenges · Leader EQ Training',
  5: '4 workshops · 2 challenges · Leader EQ · Group Coaching',
  6: '4 workshops · 4 challenges · Leader EQ · Group · 1:1 Coaching · Consultant',
};

export default function RoiProjection({ roiResult, stageNum, onStageChange }) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const stage = STAGES[stageNum - 1];
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-2">Projected ROI</h2>
      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
        Estimated annual savings from a SkillfulMeans mental fitness program across five research-backed cost drivers: medical claims, absenteeism, presenteeism, turnover, and workers' comp. Uses your inputs plus conservative published research.
      </p>
      <EscalationInfographic />
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
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs uppercase tracking-widest text-stone-400">Campaign Stage</p>
          <span className="text-sm font-semibold text-[#4a2040]">Stage {stage.num}: {stage.name}</span>
        </div>
        <p className="text-xs text-stone-500 mb-3">{STAGE_SUMMARY[stage.num]}</p>
        <input type="range" min="1" max="6" step="1" value={stageNum}
          onChange={e => onStageChange(parseInt(e.target.value))}
          className="w-full accent-[#0f766e] cursor-pointer" style={{ height: '10px' }} />
        <div className="flex justify-between text-[10px] text-stone-400 mt-1">
          {STAGES.map(s => <span key={s.num} className={s.num === stageNum ? 'font-bold text-[#0f766e]' : ''}>{s.num}</span>)}
        </div>
        <p className="text-xs text-stone-400 mt-2 italic">Slide to compare program stages — investment and ROI update live.</p>
      </div>
      <div className="mt-5 pt-4 border-t border-stone-100">
        <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Investment Breakdown</p>
        <div className="space-y-2">
          {roiResult.investmentBreakdown.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">{item.label}</span>
                <span className="text-stone-700 font-medium">{fmt(item.cost)}</span>
              </div>
              <p className="text-[10px] text-stone-400">{BREAKDOWN_EXPLANATIONS[item.label] || ''}</p>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-stone-100 mt-1">
            <span className="text-[#4a2040]">Total Investment</span>
            <span className="text-[#4a2040]">{fmt(roiResult.investment)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}