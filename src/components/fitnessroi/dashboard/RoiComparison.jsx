import React, { useState, useMemo } from 'react';
import { runRoi, STAGES } from '@/lib/roiModel';
import {
  RATE_CARD, CAMPAIGN_STAGES, sessionsPerWorkshop, challengeSlots, leadershipEqPrice, boxCountFor,
} from '@/lib/rateCard';
import SavingsChart, { DRIVERS } from '@/components/fitnessroi/dashboard/SavingsChart';
import ScenarioRangeChart from '@/components/fitnessroi/dashboard/ScenarioRangeChart';
import BenchmarkChart from '@/components/fitnessroi/dashboard/BenchmarkChart';

const CALENDLY_URL = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';

const fmtK = (v) => '$' + (v / 1000).toFixed(0) + 'k';
const fmtUSD = (v) => '$' + Math.round(v).toLocaleString();
const fmtYearly = (v) => fmtUSD(v) + '/yr';

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

// Build stage line items paired with actual breakdown costs from the model.
// Every count here is derived from the rate card, so the "~N attendees" text
// always describes the same delivery the price was calculated from.
function stageLineItems(stage, roiInputs, breakdown) {
  if (!roiInputs || !stage || !breakdown) return [];
  const N = roiInputs.employees || 0;
  const tier = CAMPAIGN_STAGES.find(s => s.stage === stage.num) || CAMPAIGN_STAGES[0];

  const sessions = sessionsPerWorkshop(N);
  const wsAttendees = Math.max(1, Math.round(N * RATE_CARD.attendanceRate));
  const slots = challengeSlots(N);
  const leq = tier.leadershipEQ
    ? leadershipEqPrice(N, { coachingBlocks: tier.coachingBlocks, lcpRounds: tier.lcpRounds })
    : null;
  const boxCount = boxCountFor(tier, N);

  const meta = {
    'Workshops & Webinars': {
      label: `${tier.workshops} workshop${tier.workshops > 1 ? 's' : ''}`,
      participants: sessions > 1
        ? `~${wsAttendees} attendees over ${sessions} sessions each`
        : `~${wsAttendees} attendees`,
    },
    'Challenges': {
      label: `${tier.challenges} challenge${tier.challenges > 1 ? 's' : ''}`,
      participants: `~${slots} participants`,
    },
    'Leader EQ Training': {
      label: 'Leader EQ Training',
      participants: leq
        ? `~${leq.leaders} leader${leq.leaders !== 1 ? 's' : ''} in ${leq.groups} group${leq.groups !== 1 ? 's' : ''}`
        : '',
    },
    'Consultant': { label: 'Consultant', participants: 'included' },
    'Wellness Boxes': {
      label: 'Wellness Boxes',
      participants: boxCount > 0 ? `${boxCount} boxes` : '',
    },
  };

  return breakdown.map((b) => {
    const m = meta[b.label] || { label: b.label, participants: '' };
    return { label: m.label, participants: m.participants, cost: b.cost };
  });
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
  const lineItems = useMemo(
    () => stageLineItems(stage, roiInputs, reactiveRoi?.investmentBreakdown),
    [stage, roiInputs, reactiveRoi]
  );

  const investmentTotal = reactiveRoi?.investment ?? 0;
  const fundAbsorbed = reactiveRoi?.fundAbsorbedAnnual ?? 0;
  const netInvestment = investmentTotal - fundAbsorbed;
  const hasWellnessFund = fundAbsorbed > 0;

  const estComposite = leaderScores?.composite;
  const teamComposite = teamScores?.composite;
  const teamLower = estComposite != null && teamComposite != null && teamComposite < estComposite;

  const estTotal3yr = preliminaryRoi?.yearProjection?.total3yr;
  const teamTotal3yr = reactiveRoi?.yearProjection?.total3yr;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      {/* ── Section header ── */}
      <h2 className="text-lg font-bold text-[#4a2040] mb-0.5">
        Projected ROI Savings
      </h2>
      <p className="text-sm text-stone-600 mb-1">
        from Implementing SkillfulMeans Mental Fitness Campaigns
      </p>
      <p className="text-xs text-stone-500 mb-5">
        One based on your estimates, one based on your team's real data.
      </p>
      {/* ── Two charts with savings headings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-3">
        {/* Left chart — estimate */}
        <div>
          <div className="mb-3 mt-10">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#4a2040]">Initial Estimated Savings</p>
              {estTotal3yr != null && (
                <p className="text-lg font-bold text-[#0f766e]">{fmtK(estTotal3yr)} over 3 years</p>
              )}
            </div>
          </div>
          {preliminaryRoi?.drivers && (
            <SavingsChart drivers={preliminaryRoi.drivers} globalMax={globalMax} />
          )}
        </div>

        {/* Right chart — team real data */}
        <div>
          <div className="mb-3 mt-10">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#4a2040]">Savings from Your Team's Real Data</p>
              {teamTotal3yr != null && (
                <p className="text-lg font-bold text-[#0f766e]">{fmtK(teamTotal3yr)} over 3 years</p>
              )}
            </div>
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

        {/* Included in Program Stage */}
        <h4 className="text-sm font-semibold text-[#0f766e] mt-4 mb-2">Included in Program Stage</h4>

        {/* Stage line items — name + participants left, cost right-aligned */}
        {lineItems.length > 0 && (
          <div className="space-y-1.5">
            {lineItems.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between text-xs gap-2">
                <span className="text-stone-600">
                  <span className="font-medium text-stone-700">{item.label}</span>
                  {item.participants && <span className="text-stone-400"> · {item.participants}</span>}
                </span>
                <span className="font-medium text-stone-700 tabular-nums shrink-0">{fmtYearly(item.cost)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Subtotal / wellness fund / net */}
        <div className="mt-3 pt-2 border-t border-teal-100 space-y-1">
          <div className="flex justify-end text-xs text-stone-600 gap-1">
            <span>Yearly Investment Subtotal:</span>
            <span className="font-medium text-stone-700 tabular-nums">{fmtUSD(investmentTotal)}</span>
          </div>
          {hasWellnessFund && (
            <>
              <div className="flex justify-end text-xs text-stone-600 gap-1">
                <span>− Wellness fund:</span>
                <span className="font-medium text-stone-700 tabular-nums">{fmtUSD(fundAbsorbed)}</span>
              </div>
              <div className="flex justify-end text-sm gap-1">
                <span className="font-bold text-[#0f766e]">Net Yearly Investment:</span>
                <span className="font-bold text-[#0f766e] tabular-nums">{fmtUSD(netInvestment)}</span>
              </div>
            </>
          )}
        </div>

        <p className="text-[10px] text-stone-400 italic mt-3">
          Only the right chart updates — your original estimate stays fixed for comparison.
        </p>

        {/* Capacity check — the rate card is not participation-neutral. */}
        {reactiveRoi?.overCapacity && (
          <p className="text-[11px] text-[#b45309] mt-2 leading-relaxed">
            ⚠ This stage is priced to serve about{' '}
            {Math.round((reactiveRoi.pricedCapacity || 0) * 100)}% of the workforce, but the projection
            credits savings at {Math.round((reactiveRoi.pf || 0) * 100)}% participation. Either buy the
            extra capacity or quote the Expected case, which prices its own.
          </p>
        )}
        {reactiveRoi?.exceedsCeiling && (
          <p className="text-[11px] text-[#b45309] mt-2 leading-relaxed">
            ⚠ This figure sits above the ceiling of research-based effect. Do not send it out — check the
            coefficients under Model.
          </p>
        )}

        {/* Book a Call — filled teal button */}
        <div className="mt-3">
          <p className="text-xs text-stone-500 mb-2">Want this tailored to your team?</p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0f766e] text-white text-xs font-semibold hover:bg-[#0d625a] transition-colors"
          >
            Book a Call — Build Your Tailored Program
          </a>
        </div>
      </div>
    </div>
  );
}