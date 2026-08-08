import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { computeQuote } from '@/lib/rateCard';

/**
 * One selectable campaign tier. Price is live for the entered headcount.
 */
export default function TierCard({ stage, headcount, selected, onSelect, recommended }) {
  const quote = computeQuote({ headcount, stage: stage.stage });
  const sections = quote.meta.sessionsPerWorkshop;

  const features = [
    // A company big enough to need several sections is buying several
    // sittings of each topic — say so on the card, not just in the quote.
    sections > 1
      ? `${stage.workshops} workshops, run ${sections}× each so everyone can attend`
      : `${stage.workshops} workshop${stage.workshops !== 1 ? 's' : ''}`,
    `${stage.challenges} 14-day challenge${stage.challenges !== 1 ? 's' : ''}`,
    ...(stage.leadershipEQ ? ['Leadership EQ program'] : []),
    ...(stage.groupCoaching ? ['Group coaching cascade'] : []),
    ...(stage.individualCoaching ? ['Individual leader coaching'] : []),
    `${quote.meta.boxCount} wellness box${quote.meta.boxCount !== 1 ? 'es' : ''}`,
  ];

  return (
    <button
      type="button"
      onClick={() => onSelect(stage.stage)}
      aria-pressed={selected}
      className={`relative text-left w-full rounded-2xl border-2 p-5 transition-all ${
        selected
          ? 'border-brand-navy bg-brand-navy/[0.04] shadow-md'
          : 'border-gray-200 bg-white hover:border-brand-navy/40 hover:shadow-sm'
      }`}
    >
      {recommended && !selected && (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-brand-lime px-2.5 py-0.5 text-[11px] font-bold text-brand-navy">
          <Sparkles className="w-3 h-3" /> Most popular
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Stage {stage.stage}</p>
          <h3 className="text-lg font-bold text-gray-800 leading-tight">{stage.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{stage.tagline}</p>
        </div>
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
            selected ? 'border-brand-navy bg-brand-navy' : 'border-gray-300'
          }`}
        >
          {selected && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
      </div>

      <p className="text-2xl font-bold text-brand-navy mt-3">
        ${quote.total.toLocaleString()}
        <span className="text-sm font-normal text-gray-400"> / campaign</span>
      </p>

      <ul className="mt-3 space-y-1.5">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
            <Check className="w-3.5 h-3.5 text-brand-green flex-shrink-0 mt-[3px]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
