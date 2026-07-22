import React, { useState, useMemo } from 'react';
import { runRoi, STAGES, CHALLENGE_TIERS, LEQ_PER_LEADER, LEADER_FRACTION } from '@/lib/roiModel';
import SavingsChart, { DRIVERS } from '@/components/fitnessroi/dashboard/SavingsChart';

const CALENDLY_URL = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';

const fmtK = (v) => '$' + (v / 1000).toFixed(0) + 'k';

// Nice-step ceiling: headroom never exceeds ~15% above the tallest bar
function niceMax(rawMax) {
  if (rawMax <= 0) return 100;
  let step = Math.pow(10, Math.floor(Math.log10(rawMax / 5)));
  let niceMaxVal = Math.ceil(rawMax / step) * step;
  while (niceMaxVal > rawMax * 1.15 && step > 1) {
    step /= 2;
    niceMaxVal = Math.ceil(rawMax / step) * step;
  }
  return niceMaxVal;
}

function getChallengePrice(n) {
  let price = CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].price;
  for (const tier of CHALLENGE_TIERS) {
    if (n >= tier.min) price = tier.price;
  }
  return price;
}

// Build stage line items with per-unit cost + participant count from roiModel data
function stageLineItems(stage, roiInputs) {
  if (!roiInputs || !stage) return [];
  const N = roiInputs.employees || 0;
  const participRate = roiInputs.participRate || 0.25;
  const items = [];

  if (stage.workshops > 0) {
    const wsAttendees = Math.max(1, Math.round(N * participRate));
    items.push({
      label: `${stage.workshops} workshop${stage.workshops > 1 ? 's' : ''}`,
      cost: '$1,500 each',
      participants: `~${wsAttendees} attendees`,
    });
  }

  if (stage.challenges > 0) {
    const participatingN = Math.max(40, Math.round(N * participRate));
    const price = getChallengePrice(participatingN);
    items.push({
      label: `${stage.challenges} challenge${stage.challenges > 1 ? 's' : ''}`,
      cost: `$${price}/person`,
      participants: `~${participatingN} participants`,
    });
  }

  if (stage.leq) {
    const leaders = Math.max(1, Math.round(N * LEADER_FRACTION));
    items.push({
      label: 'Leader EQ Training',
      cost: `$${LEQ_PER_LEADER}/leader`,
      participants: `~${leaders} leaders`,
    });
  }

  if (stage.groupCoaching) {
    const cohorts = Math.ceil((N * 0.16) / 12);
    items.push({
      label: 'Group Coaching',
      cost: '$5,000/cohort',
      participants: `~${cohorts} cohort${cohorts !== 1 ? 's' : ''}`,
    });
  }

  if (stage.indivCoaching) {
    const people = Math.round(N * 0.05);
    items.push({
      label: '1:1 Coaching',
      cost: '$5,000/person',
      participants: `~${people} people`,
    });
  }

  if (stage.consultant) {
    items.push({
      label: 'Consultant',
      cost: stage.consultantFree ? 'included' : '$10,000',
      participants: '',
    });
  }

  return items;
}

export default function RoiComparison({ preliminaryRoi, teamRoi, roiInputs, stressRateReal, leaderScores, teamScores }) {
  const [stageNum, setStageNum] = useState(roiInputs?.stageNum || 2);

  const reactiveRoi = useMemo(() => {
    if (!roiInputs) return teamRoi;
    return runRoi({ ...roiInputs, stressRate: stressRateReal, stageNum });
  }, [roiInputs, stressRateReal, stageNum, teamRoi]);

  // Locked y-axis max — tallest stacked-bar total (Year 3) across both charts and all stages
  const globalMax = useMemo(() => {
    let max = 0;
    if (preliminaryRoi?.yearProjection?.y3) {
      max = Math.max(max, preliminaryRoi.yearProjection.y3);
    }
    if (roiInputs) {
      for (const s of STAGES) {
        const r = runRoi({ ...roiInputs, stressRate: stressRateReal, stageNum: s.num });
        max = Math.max(max, r.yearProjection?.y3 || 0);
      }
    }
    return niceMax(max);
  }, [preliminaryRoi, roiInputs, stressRateReal]);

  const stage = STAGES[stageNum - 1];
  const lineItems = useMemo(() => stageLineItems(stage, roiInputs), [stage, roiInputs]);

  const estComposite = leaderScores?.composite;
  const teamComposite = teamScores?.composite;
  const teamLower = estComposite != null && teamComposite != null && teamComposite < estComposite;

  const estTotal3yr = preliminaryRoi?.yearProjection?.total3yr;
  const teamTotal3yr = reactiveRoi?.yearProjection?.total3yr;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      {/* ── Section header ── */}
      <h2 className="text-base font-bold text-[#4a2040] mb-1">
        Projected ROI Savings from Implementing SkillfulMeans Mental Fitness Campaigns
      </h2>
      <p className="text-xs text-stone-500 mb-5">
        One based on your estimates, one based on your team's real data.
      </p>

      {/* ── Two charts with scores + 3-year totals ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-3">
        {/* Left chart — estimate */}
        <div>
          <div className="mb-2">
            <p className="text-sm text-stone-600">
              Your estimated score:{' '}
              <span className="font-semibold text-stone-800">
                {estComposite != null ? Math.round(estComposite) : '—'}
              </span>
            </p>
            <p className="text-[13px] font-semibold text-stone-700 mt-1">Your estimate</p>
            {estTotal3yr != null && (
              <p className="text-sm font-bold text-stone-800">{fmtK(estTotal3yr)} over 3 years</p>
            )}
          </div>
          {preliminaryRoi?.drivers && (
            <SavingsChart drivers={preliminaryRoi.drivers} globalMax={globalMax} />
          )}
        </div>

        {/* Right chart — team real data */}
        <div>
          <div className="mb-2">
            <p className="text-sm text-stone-600">
              Your team's real score:{' '}
              <span
                className={`font-semibold ${
                  teamLower ? 'text-red-600 bg-red-100 px-1.5 py-0.5 rounded' : 'text-stone-800'
                }`}
              >
                {teamComposite != null ? Math.round(teamComposite) : '—'}
              </span>
            </p>
            <p className="text-[13px] font-semibold text-stone-700 mt-1">Your team's real data</p>
            {teamTotal3yr != null && (
              <p className="text-sm font-bold text-stone-800">{fmtK(teamTotal3yr)} over 3 years</p>
            )}
          </div>
          {reactiveRoi?.drivers && (
            <SavingsChart drivers={reactiveRoi.drivers} globalMax={globalMax} />
          )}
        </div>
      </div>

      {/* ── Shared legend — below charts ── */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
        {DRIVERS.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[11px] text-stone-600">{d.label}</span>
          </div>
        ))}
      </div>

      {/* ── Program Stage panel ── */}
      <div className="bg-teal-50/50 rounded-xl p-4 border border-teal-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#0f766e]">Program Stage</h3>
            <span className="text-[10px] text-[#0f766e] bg-teal-100 px-2 py-0.5 rounded-full font-medium">
              controls the right chart →
            </span>
          </div>
          <span className="text-sm font-semibold text-[#0f766e]">
            Stage {stage.num} — {stage.name}
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

        {/* Stage line items with cost + participants */}
        {lineItems.length > 0 && (
          <div className="mt-3 space-y-1">
            {lineItems.map((item, i) => (
              <div key={i} className="text-xs text-stone-600 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-stone-700">{item.label}</span>
                <span className="text-stone-400">·</span>
                <span>{item.cost}</span>
                {item.participants && (
                  <>
                    <span className="text-stone-400">·</span>
                    <span>{item.participants}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-stone-400 italic mt-3">
          Only the right chart updates — your original estimate stays fixed for comparison.
        </p>

        {/* Book a call — compact inline CTA */}
        <p className="text-xs text-stone-500 mt-3">
          Want this tailored to your team?{' '}
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0f766e] font-medium hover:underline"
          >
            Book a call
          </a>{' '}
          and we'll build your program together.
        </p>
      </div>
    </div>
  );
}