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
  conditions = {}, onChange, headcount = 0, boxCount, compact = false,
}) {
  const rate = participationFrom(conditions);
  const ceilingRate = participationAtFullDelivery();
  const reached = Math.round(headcount * rate);
  const chosen = CONDITIONS.filter(c => conditions[c.key]).length;
  const remaining = CONDITIONS.length - chosen;

  const toggle = (key) => onChange?.({ ...conditions, [key]: !conditions[key] });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#4a2040] p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#4a2040] mb-1">
        How you run it matters more than what you buy
      </h2>
      <p className="text-xs text-stone-500 mb-5 leading-relaxed">
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
                  ? 'border-[#0f766e] bg-teal-50/60'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${
                  on ? 'bg-[#0f766e] border-[#0f766e] text-white' : 'border-stone-300 bg-white'
                }`}
              >
                {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#4a2040]">{c.title}</span>
                {!compact && (
                  <span className="block text-xs text-stone-500 leading-relaxed mt-0.5">{c.detail}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Standard delivery — not a client option, so not a toggle. */}
      <div className="mt-3 rounded-xl bg-amber-50/70 border border-amber-100 p-3 flex gap-3">
        <Gift className="w-4 h-4 text-[#b8860b] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#4a2040]">
            Included either way{boxCount ? ` — ${boxCount} wellness boxes` : ' — wellness boxes'}, raffled
            among the people who take part
          </p>
          <p className="text-xs text-stone-500 leading-relaxed mt-0.5">
            Three per workshop session and three per challenge. A draw motivates better than giving
            everyone the same thing, so it&rsquo;s how we run every campaign. Already in your price.
          </p>
        </div>
      </div>

      {/* Live readout */}
      <div className="mt-4 pt-4 border-t border-stone-100 flex items-start gap-5">
        <div className="shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-0.5">
            People likely to take part
          </p>
          <p className="text-3xl font-bold text-[#0f766e] tabular-nums">{Math.round(rate * 100)}%</p>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed pt-4">
          {headcount > 0 && (
            <>
              Around <b className="text-stone-700">{reached.toLocaleString()}</b> of your{' '}
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
