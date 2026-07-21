import React, { useState, useMemo } from 'react';
import { runRoi } from '@/lib/roiModel';
import JourneyScoreDial from '@/components/fitnessroi/JourneyScoreDial';
import JourneyScoreBars from '@/components/fitnessroi/JourneyScoreBars';
import RoiProjection from '@/components/fitnessroi/RoiProjection';
import AssumptionsPanel from '@/components/fitnessroi/AssumptionsPanel';
import PrimaryCta from '@/components/fitnessroi/PrimaryCta';

export default function ResultsView({ data, hideCta }) {
  const { quick_scores, roi_snapshot, magic_key } = data;
  const [roiInputs, setRoiInputs] = useState(roi_snapshot.inputs);
  const roiResult = useMemo(() => runRoi(roiInputs), [roiInputs]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#4a2040] mb-1">Your Mental Fitness Snapshot</h2>
        <p className="text-xs text-stone-500 mb-5 leading-relaxed">
          Each domain is scored 0–100 (higher is better). The shaded bands show Low, Typical, and High ranges from published research norms — the marker is where you placed your team.
        </p>
        <div className="flex flex-col items-center">
          <JourneyScoreDial score={quick_scores.composite} />
          <p className="text-sm text-stone-500 mt-3 text-center italic">This score reflects your view as a leader.</p>
        </div>
        <div className="mt-6">
          <JourneyScoreBars scores={quick_scores} />
        </div>
      </div>
      <RoiProjection roiResult={roiResult} stageNum={roiInputs.stageNum}
        onStageChange={(stageNum) => setRoiInputs(prev => ({ ...prev, stageNum }))} />
      <AssumptionsPanel inputs={roiInputs} onChange={setRoiInputs} headcount={roi_snapshot.inputs.employees} />
      {!hideCta && <PrimaryCta magicKey={magic_key} />}
    </div>
  );
}