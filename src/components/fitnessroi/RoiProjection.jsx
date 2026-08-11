import React from 'react';
import RoiRampChart from '@/components/fitnessroi/RoiRampChart';
import EscalationInfographic from '@/components/fitnessroi/EscalationInfographic';
import ScenarioRange from '@/components/fitnessroi/ScenarioRange';
import { STAGES } from '@/lib/roiModel';

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

export default function RoiProjection({ roiResult, stageNum, onStageChange, headcount }) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const stage = STAGES[stageNum - 1];
  const reached = headcount ? Math.round(headcount * (roiResult.pf || 0)) : null;
  const perDollar = roiResult.rawPerDollar || 0;

  return (
    <div className="mf-card border-l-4 border-l-mf-plum p-6 shadow-sm">
      <h2 className="text-lg font-bold text-mf-plum mb-2">What a year of this could return</h2>
      <p className="text-xs text-mf-ink-2 mb-4 leading-relaxed">
        Estimated annual value from a SkillfulMeans mental fitness programme across four cost drivers we
        can evidence: recovered working time, reduced absence, retention, and the healthcare pathway.
        Every figure is built from your own inputs and published research — nothing here is a rule of
        thumb.
      </p>
      <EscalationInfographic />

      {/* ── Headline ── */}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-mf-ink-3 mb-1">Annual Value</p>
          <p className="text-xl font-bold text-mf-plum">{fmt(roiResult.annualSavings)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-mf-ink-3 mb-1">Return per $1</p>
          <p className="text-xl font-bold text-mf-plum">{perDollar.toFixed(2)}:1</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-mf-ink-3 mb-1">Payback</p>
          <p className="text-xl font-bold text-mf-plum">
            {Number.isFinite(roiResult.paybackMonths) ? `${roiResult.paybackMonths} mo` : '—'}
          </p>
        </div>
      </div>
      <p className="text-xs text-mf-ink-2 mb-5 leading-relaxed">
        Against an investment of <b className="text-mf-ink">{fmt(roiResult.investment)}</b>
        {reached != null
          ? <>, reaching about <b className="text-mf-ink">{reached.toLocaleString()}</b> of your people. </>
          : '. '}
        This is the number we&rsquo;d plan against, not the best case.
      </p>

      <RoiRampChart drivers={roiResult.drivers} />

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
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-mf-rule mt-1">
            <span className="text-mf-plum">Total Investment</span>
            <span className="text-mf-plum">{fmt(roiResult.investment)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
