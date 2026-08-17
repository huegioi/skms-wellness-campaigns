import React, { useState, useMemo } from 'react';
import { runRoi, participationFrom, deliveryAt, STAGES } from '@/lib/roiModel';
import JourneyScoreDial from '@/components/fitnessroi/JourneyScoreDial';
import JourneyScoreBars from '@/components/fitnessroi/JourneyScoreBars';
import RoiProjection from '@/components/fitnessroi/RoiProjection';
import ParticipationBuilder from '@/components/fitnessroi/ParticipationBuilder';
import AssumptionsPanel from '@/components/fitnessroi/AssumptionsPanel';
import PrimaryCta from '@/components/fitnessroi/PrimaryCta';
import ClaimsHandoffCta from '@/components/warm/ClaimsHandoffCta';

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

  // Sections, boxes and cost all follow the participation the buyer just chose.
  // At 1,000 people and every commitment made this is 2 sections per workshop
  // and 15 boxes at Stage 1 -- the figure William quoted -- where the rate
  // card's priced default is 1 section and 9 boxes. Both are correct; they
  // describe different take-up. See deliveryAt().
  const delivery = useMemo(
    () => deliveryAt(STAGES[(roiInputs.stageNum || 2) - 1], headcount, participRate),
    [roiInputs.stageNum, headcount, participRate],
  );

  // ── Layout ──────────────────────────────────────────────────────────────
  // On the public Journey the team-survey CTA and its locked preview sit in a
  // right-hand column BESIDE the snapshot, not above it, so the scores are the
  // first thing on screen. Placement is explicit (col-start / row-start) so the
  // mobile stack still reads snapshot → CTA → the rest, while desktop gets a
  // main column with a sticky sidebar that follows you down the numbers.
  // items-start is required: a stretched sidebar item would kill the sticky.
  // The dashboard passes hideCta and keeps its single column untouched.
  const mainCol = hideCta ? '' : 'lg:col-span-3 lg:col-start-1';

  return (
    <div className={hideCta ? 'space-y-6' : 'grid gap-6 items-start lg:grid-cols-5'}>
      <div className={`${mainCol} ${hideCta ? '' : 'lg:row-start-1'}`}>
        <div className="mf-card p-6">
          <h2 className="mf-serif text-[24px] text-mf-plum mb-1.5">Your Mental Fitness Snapshot</h2>
          <p className="text-xs text-mf-ink-2 mb-5 leading-relaxed">
            Each domain is scored 0–100 (higher is better). The shaded bands show Low, Typical, and High ranges from published research norms — the marker is where you placed your team.
          </p>
          <div className="flex flex-col items-center">
            <JourneyScoreDial score={quick_scores.composite} />
            <p className="text-sm text-mf-ink-2 mt-3 text-center italic">This score reflects your view as a leader.</p>
          </div>
          <div className="mt-6">
            <JourneyScoreBars scores={quick_scores} />
          </div>
        </div>
      </div>

      {!hideCta && (
        <div className="lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
          <PrimaryCta magicKey={magic_key} />
        </div>
      )}

      <div className={`space-y-6 ${mainCol} ${hideCta ? '' : 'lg:row-start-2'}`}>
        <ParticipationBuilder
          conditions={conditions}
          onChange={setConditions}
          headcount={headcount}
          delivery={delivery}
        />

        <RoiProjection
          roiResult={roiResult}
          stageNum={roiInputs.stageNum}
          headcount={headcount}
          delivery={delivery}
          onStageChange={(stageNum) => setRoiInputs(prev => ({ ...prev, stageNum }))}
        />

        <AssumptionsPanel
          inputs={{ ...roiInputs, participRate }}
          onChange={setRoiInputs}
          headcount={headcount}
          conditionCount={Object.values(conditions).filter(Boolean).length}
        />

        {/* Second path, offered after the projection rather than instead of the
            team survey: the team survey deepens the perception picture, the
            claims read corroborates it with money. Either is a real next step;
            the dashboard renders its own copy of this, hence !hideCta. */}
        {!hideCta && (
          <ClaimsHandoffCta
            magicKey={magic_key}
            headcount={headcount}
            avgSalary={roiInputs.avgSalary}
          />
        )}
      </div>
    </div>
  );
}
