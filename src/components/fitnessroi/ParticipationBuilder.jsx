import React from 'react';
import { Check, Gift } from 'lucide-react';
import { participationFrom, participationAtFullDelivery, RESEARCH_MODEL } from '@/lib/roiModel';

/**
 * "How you run it matters" — the four design conditions a client actually
 * chooses, plus the raffle, which is standard SkillfulMeans delivery and so is
 * always on.
 *
 * Every uplift here is an odds ratio from RESEARCH_MODEL.participation.or.
 * Odds compound; percentages do not — so this component never adds anything.
 * It hands the condition set to participationFrom() and shows the result.
 *
 * Buyer-facing copy only. No study names, no coefficients, no "scenario"
 * language. The buyer is making a choice, not reading a paper.
 */
const CONDITIONS = [
  {
    key: 'optOut',
    title: 'Everyone is enrolled, and can step out',
    detail: 'Rather than asking people to sign up. This reaches the colleagues who would never put their hand up — often the ones who need it most.',
  },
  {
    key: 'workday',
    title: 'Sessions happen during work hours',
    detail: 'Not lunch breaks or evenings. Wellbeing that costs people their own time is wellbeing most of them decline.',
  },
  {
    key: 'noCost',
    title: 'Nothing is charged to the employee',
    detail: 'No co-pay, no deposit, nothing at risk.',
  },
  {
    key: 'teamLeader',
    title: 'Teams take part together, leaders included',
    detail: 'Whole teams rather than scattered individuals, with managers visibly joining in.',
  },
];

export default function ParticipationBuilder({
  conditions = {}, onChange, headcount = 0, delivery, compact = false,
}) {
  const rate = participationFrom(conditions);
  const ceilingRate = participationAtFullDelivery();
  const reached = Math.round(headcount * rate);
  const chosen = CONDITIONS.filter(c => conditions[c.key]).length;
  const remaining = CONDITIONS.length - chosen;

  const toggle = (key) => onChange?.({ ...conditions, [key]: !conditions[key] });

  return (
    <div className="mf-card border-l-4 border-l-mf-coral p-6 shadow-sm">
      <h2 className="text-lg font-bold text-mf-plum mb-1">
        How you run it matters more than what you buy
      </h2>
      <p className="text-xs text-mf-ink-2 mb-5 leading-relaxed">
        Most of what decides whether a programme works is set before it starts — and it&rsquo;s yours to
        choose. Tell us what you could commit to.
      </p>

      <div className="space-y-2">
        {CONDITIONS.map((c) => {
          const on = !!conditions[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              className={`w-full text-left flex gap-3 rounded-xl border p-3 transition-colors ${
                on
                  ? 'border-mf-plum bg-mf-cream'
                  : 'border-mf-rule bg-white hover:border-mf-rule'
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${
                  on ? 'bg-mf-plum border-mf-plum text-white' : 'border-mf-rule bg-white'
                }`}
              >
                {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-mf-plum">{c.title}</span>
                {!compact && (
                  <span className="block text-xs text-mf-ink-2 leading-relaxed mt-0.5">{c.detail}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Standard delivery — not a client option, so not a toggle. The box
       *  count MOVES with the toggles above: more people means more sections,
       *  and boxes are handed out per section. See deliveryAt(). */}
      <div className="mt-3 rounded-xl bg-amber-50/70 border border-amber-100 p-3 flex gap-3">
        <Gift className="w-4 h-4 text-mf-coral shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-mf-plum">
            Included either way{delivery?.boxes ? ` — ${delivery.boxes} wellness boxes` : ' — wellness boxes'},
            raffled among the people who take part
          </p>
          <p className="text-xs text-mf-ink-2 leading-relaxed mt-0.5">
            Three per workshop section and three per challenge. A draw motivates better than giving
            everyone the same thing, so it&rsquo;s how we run every campaign.
            {delivery?.sessionsPerTopic > 1 && (
              <> At this level of take-up each workshop runs{' '}
                <b className="text-mf-ink">{delivery.sessionsPerTopic} times</b>, so people have a
                choice of when to attend — which is also why the box count goes up.</>
            )}
          </p>
        </div>
      </div>

      {/* Live readout */}
      <div className="mt-4 pt-4 border-t border-mf-rule flex items-start gap-5">
        <div className="shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-mf-ink-3 mb-0.5">
            People likely to take part
          </p>
          <p className="text-3xl font-bold text-mf-plum tabular-nums">{Math.round(rate * 100)}%</p>
        </div>
        <p className="text-xs text-mf-ink-2 leading-relaxed pt-4">
          {headcount > 0 && (
            <>
              Around <b className="text-mf-ink">{reached.toLocaleString()}</b> of your{' '}
              {headcount.toLocaleString()} people, staying with it — not just signing up.{' '}
            </>
          )}
          {remaining > 0
            ? `${remaining === 1 ? 'One more commitment' : `${remaining} more commitments`} would take that to ${Math.round(ceilingRate * 100)}%.`
            : 'That is as far as design alone can take it.'}
        </p>
      </div>
    </div>
  );
}

export { CONDITIONS as PARTICIPATION_CONDITIONS, RESEARCH_MODEL };
