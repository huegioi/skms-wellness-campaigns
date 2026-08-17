import React from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { RATE_CARD } from '@/lib/rateCard';

/**
 * Line-itemed quote. `quote` comes from computeQuote() in the rate card.
 *
 * The "first campaign with us" checkbox used to live here, but the inquiry is
 * now submitted from the gallery step — one screen earlier — so the discount
 * has to be decided before that. It moved up to the tier step; this component
 * just renders whatever discount the quote already carries.
 */
export default function QuoteBreakdown({ quote }) {
  if (!quote) return null;

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="bg-gradient-to-br from-brand-green to-brand-navy rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-brand-lime" />
          <span className="text-xs font-bold uppercase tracking-wide text-brand-lime">
            Your estimate — {quote.tier.name}
          </span>
        </div>
        <p className="text-4xl font-bold">${quote.total.toLocaleString()}</p>
        <p className="text-xs text-white/70 mt-1">
          For {quote.headcount.toLocaleString()} employees, for the full campaign
        </p>
      </div>

      {/* Line items */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {quote.lines.map(line => (
          <div key={line.key} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-800">{line.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{line.detail}</p>
            </div>
            <p className="font-semibold text-sm text-gray-800 whitespace-nowrap">
              ${line.amount.toLocaleString()}
            </p>
          </div>
        ))}

        <div className="flex items-center justify-between p-4 bg-gray-50">
          <span className="text-sm font-medium text-gray-600">Subtotal</span>
          <span className="text-sm font-semibold text-gray-800">${quote.subtotal.toLocaleString()}</span>
        </div>

        {quote.discounts.map(d => (
          <div key={d.label} className="flex items-center justify-between p-4 bg-green-50/60">
            <span className="text-sm font-medium text-green-800">{d.label}</span>
            <span className="text-sm font-semibold text-green-700">−${d.amount.toLocaleString()}</span>
          </div>
        ))}

        <div className="flex items-center justify-between p-4">
          <span className="text-base font-bold text-gray-800">Total</span>
          <span className="text-xl font-bold text-brand-navy">${quote.total.toLocaleString()}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="flex items-start gap-2 text-xs text-gray-400 px-1">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Built from our standard rate card. In-person delivery adds a $
          {RATE_CARD.inPersonTravelAddOn} travel fee per trip and isn't included above. Your tailored proposal may vary.
        </p>
      </div>

      {/* The ROI link used to sit here too, but by this point they've already
          sent their details and the page ends on booking a call — sending them
          off to another tool competes with that. It still appears on the tier
          step, which is where the return actually informs a decision. */}
    </div>
  );
}
