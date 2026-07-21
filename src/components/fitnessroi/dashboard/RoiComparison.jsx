import React from 'react';
import RoiRampChart from '@/components/fitnessroi/RoiRampChart';

export default function RoiComparison({ preliminaryRoi, teamRoi, estimatedStressRate, realStressRate }) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const estPct = Math.round((estimatedStressRate || 0) * 100);
  const realPct = Math.round((realStressRate || 0) * 100);

  const StatCol = ({ label, roi, accent }) => (
    <div>
      <p className={`text-xs uppercase tracking-widest mb-3 ${accent ? 'text-[#0f766e]' : 'text-stone-400'}`}>{label}</p>
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-sm"><span className="text-stone-500">Annual Savings</span><span className={`font-bold ${accent ? 'text-[#0f766e]' : 'text-stone-700'}`}>{fmt(roi.annualSavings)}</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-500">Net ROI</span><span className={`font-bold ${accent ? 'text-[#0f766e]' : 'text-stone-700'}`}>{Math.round(roi.netROI)}%</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-500">Payback</span><span className={`font-bold ${accent ? 'text-[#0f766e]' : 'text-stone-700'}`}>{roi.paybackMonths} mo</span></div>
      </div>
      <RoiRampChart drivers={roi.drivers} />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-1">Your ROI, re-run on real data</h2>
      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
        Same model, one change: your estimated share of high-stress employees is replaced by the share your team actually reported. Everything downstream — savings, payback, the three-year trajectory — updates from that real number.
      </p>
      <div className="bg-[#fce7f3] border border-pink-200 rounded-xl p-3 mb-5">
        <p className="text-sm text-[#4a2040]">You estimated {estPct}% of your team at high stress; their responses show {realPct}%.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {preliminaryRoi && <StatCol label="Preliminary" roi={preliminaryRoi} />}
        <StatCol label="Team re-run" roi={teamRoi} accent />
      </div>
    </div>
  );
}