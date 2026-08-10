import React, { useState, useMemo } from 'react';
import { runRoi, participationFrom } from '@/lib/roiModel';
import { CAMPAIGN_STAGES, boxCountFor } from '@/lib/rateCard';
import JourneyScoreDial from '@/components/fitnessroi/JourneyScoreDial';
import JourneyScoreBars from '@/components/fitnessroi/JourneyScoreBars';
import RoiProjection from '@/components/fitnessroi/RoiProjection';
import ParticipationBuilder from '@/components/fitnessroi/ParticipationBuilder';
import AssumptionsPanel from '@/components/fitnessroi/AssumptionsPanel';
import PrimaryCta from '@/components/fitnessroi/PrimaryCta';

export default function ResultsView({ data, hideCta }) {
  const { quick_scores, roi_snapshot, magic_key } = data;
  const [roiInputs, setRoiInputs] = useState(roi_snapshot.inputs);

  // The design conditions the buyer says they could commit to. Participation is
  // derived from these, never typed in and never guessed from headcount — see
  // RESEARCH_MODEL.participation. Snapshots taken before this existed simply
  // start with nothing committed, which is the observed floor.
  const [conditions, setConditions] = useState(roi_snapshot.inputs?.participConditions || {});

  const participRate = useMemo(() => participationFrom(conditions), [conditions]);

  const roiResult = useMemo(
    () => runRoi({ ...roiInputs, participRate, participConditions: conditions }),
    [roiInputs, participRate, conditions],
  );

  const headcount = roiInputs.employees || roi_snapshot.inputs.employees || 0;
  const boxCount = useMemo(() => {
    const tier = CAMPAIGN_STAGES.find(s => s.stage === (roiInputs.stageNum || 2)) || CAMPAIGN_STAGES[0];
    return boxCountFor(tier, headcount);
  }, [roiInputs.stageNum, headcount]);

  return (
    <div className="space-y-6">
      {!hideCta && <PrimaryCta magicKey={magic_key} />}
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

      <ParticipationBuilder
        conditions={conditions}
        onChange={setConditions}
        headcount={headcount}
        boxCount={boxCount}
      />

      <RoiProjection
        roiResult={roiResult}
        stageNum={roiInputs.stageNum}
        headcount={headcount}
        onStageChange={(stageNum) => setRoiInputs(prev => ({ ...prev, stageNum }))}
      />

      <AssumptionsPanel
        inputs={{ ...roiInputs, participRate }}
        onChange={setRoiInputs}
        headcount={headcount}
        conditionCount={Object.values(conditions).filter(Boolean).length}
      />
    </div>
  );
}
