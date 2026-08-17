import React from 'react';
import EscalationInfographic from '@/components/fitnessroi/EscalationInfographic';
import ScenarioRange from '@/components/fitnessroi/ScenarioRange';
import { STAGES } from '@/lib/roiModel';
import { DRIVERS as DRIVER_ROWS } from '@/components/fitnessroi/dashboard/SavingsChart';

const BREAKDOWN_EXPLANATIONS = {
  'Workshops & Webinars': 'Live expert-led sessions on stress, resilience, and mental fitness',
  'Challenges': 'Time-boxed team challenges (e.g. 14-day calm or movement)',
  'Leader EQ Training': 'Equips managers with emotional intelligence and mental health conversation skills',
  'Group Coaching': 'Small-cohort coaching for deeper behavior change',
  'Individual Coaching': '1:1 coaching for high-need employees',
  'Consultant': 'Dedicated wellness consultant embedded with your team',
  'Wellness Boxes': 'Raffled among the people who take part — three per workshop session, three per challenge',
};

const STAGE_SUMMARY = {
  1: '2 workshops · 1 challenge',
  2: '4 workshops · 2 challenges',
  3: '2 workshops · 2 challenges · Leader EQ Training',
  4: '4 workshops · 2 challenges · Leader EQ Training',
  5: '4 workshops · 2 challenges · Leader EQ · Group Coaching',
  6: '4 workshops · 4 challenges · Leader EQ · Group · 1:1 Coaching · Consultant',
};

export default function RoiProjection({ roiResult, stageNum, onStageChange, headcount, delivery }) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const stage = STAGES[stageNum - 1];
  const reached = delivery?.reached ?? (headcount ? Math.round(headcount * (roiResult.pf || 0)) : null);

  // The quoted investment is what it costs to SERVE the participation we are
  // claiming savings for, not the rate card's default. The rate card seats a
  // quarter of a workforce; the commitments above can take turnout past that,
  // which needs a second section of every workshop and more boxes. Quoting the
  // lower price beside the higher savings is the mistake the old participation
  // slider made -- a numerator that moves while the denominator stands still.
  const investment = delivery?.cost ?? roiResult.investment;
  const capacityUplift = delivery ? Math.max(0, delivery.cost - delivery.pricedCost) : 0;
  const perDollar = investment > 0 ? roiResult.annualSavings / investment : 0;

  return (
    <div className="mf-card p-6">
      <p className="mf-eyebrow mb-2">Your projection</p>
      <h2 className="mf-serif text-[26px] leading-tight text-mf-plum mb-3">What a year of this could return</h2>
      <p className="text-xs text-mf-ink-2 mb-4 leading-relaxed">
        Estimated annual value from a SkillfulMeans mental fitness program across four cost drivers we
        can evidence: recovered working time, reduced absence, retention, and the healthcare pathway.
        Every figure is built from your own inputs and published research — nothing here is a rule of
        thumb.
      </p>
      <EscalationInfographic />

      {/* ── Headline ── */}
      <div className="mf-figbox p-7 mb-5">
        <p className="text-[11px] uppercase tracking-[0.07em] opacity-60">Estimated annual value</p>
        <p className="mf-serif text-[46px] leading-none tabular-nums my-2">{fmt(roiResult.annualSavings)}</p>
        <p className="text-[13px] leading-relaxed opacity-80">
          against an investment of {fmt(investment)} — a return of about{' '}
          {perDollar.toFixed(2)} for every dollar.
        </p>
        <div className="mt-5 pt-4 border-t border-white/20 space-y-1.5">
          {reached != null && (
            <div className="flex justify-between text-[13px]">
              <span className="opacity-70">People reached</span>
              <b className="tabular-nums">{reached.toLocaleString()}</b>
            </div>
          )}
          {DRIVER_ROWS.map(d => (
            <div key={d.key} className="flex justify-between text-[13px]">
              <span className="opacity-70">{d.label}</span>
              <b className="tabular-nums">{fmt(roiResult.drivers[d.key] || 0)}</b>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-mf-ink-2 mb-5 leading-relaxed">
        This is the number we&rsquo;d plan against, not the best case.
      </p>

      {/* ── The range ── */}
      {roiResult.scenarios && (
        <div className="mt-6 pt-5 border-t border-mf-rule">
          <ScenarioRange scenarios={roiResult.scenarios} />
        </div>
      )}

      {/* ── Stage slider ── */}
      <div className="mt-5 pt-4 border-t border-mf-rule">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs uppercase tracking-widest text-mf-ink-3">Campaign Stage</p>
          <span className="text-sm font-semibold text-mf-plum">Stage {stage.num}: {stage.name}</span>
        </div>
        <p className="text-xs text-mf-ink-2 mb-3">{STAGE_SUMMARY[stage.num]}</p>
        <input type="range" min="1" max="6" step="1" value={stageNum}
          onChange={e => onStageChange(parseInt(e.target.value))}
          className="w-full accent-mf-plum cursor-pointer" style={{ height: '10px' }} />
        <div className="flex justify-between text-[10px] text-mf-ink-3 mt-1">
          {STAGES.map(s => <span key={s.num} className={s.num === stageNum ? 'font-bold text-mf-plum' : ''}>{s.num}</span>)}
        </div>
        <p className="text-xs text-mf-ink-3 mt-2 italic">Slide to compare program stages — investment and return update live.</p>
      </div>

      {/* ── Investment breakdown ── */}
      <div className="mt-5 pt-4 border-t border-mf-rule">
        <p className="text-xs uppercase tracking-widest text-mf-ink-3 mb-2">Investment Breakdown</p>
        <div className="space-y-2">
          {roiResult.investmentBreakdown.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm">
                <span className="text-mf-ink-2">{item.label}</span>
                <span className="text-mf-ink font-medium">{fmt(item.cost)}</span>
              </div>
              <p className="text-[10px] text-mf-ink-3">{BREAKDOWN_EXPLANATIONS[item.label] || ''}</p>
            </div>
          ))}
          {capacityUplift > 0 && (
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-mf-ink-2">Capacity for {reached?.toLocaleString()} participants</span>
                <span className="text-mf-ink font-medium">+{fmt(capacityUplift)}</span>
              </div>
              <p className="text-[10px] text-mf-ink-3">
                The commitments you chose take turnout past what a standard campaign seats, so each
                workshop runs {delivery.sessionsPerTopic} times and there are more boxes to raffle
              </p>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-mf-rule mt-1">
            <span className="text-mf-plum">Total Investment</span>
            <span className="text-mf-plum">{fmt(investment)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
