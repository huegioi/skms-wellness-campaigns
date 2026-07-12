import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, ExternalLink } from 'lucide-react';
import { ROI_CALCULATOR_URL, formatComposition } from '@/components/quickbuilder/stagePricing';

/**
 * Estimate + matched-stage card shown on the Quick Builder review step.
 * Props come from computeEstimate() in stagePricing.js.
 */
export default function ReviewEstimateCard({ estimate }) {
  if (!estimate) return null;

  const { estimatedInvestment, matchedStage, stageLabel, breakdown } = estimate;

  return (
    <div className="space-y-3">
      {/* Estimated investment */}
      <div className="bg-gradient-to-br from-brand-green to-brand-navy rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-brand-lime" />
          <span className="text-xs font-bold uppercase tracking-wide text-brand-lime">Estimated investment</span>
        </div>
        <p className="text-3xl font-bold">${estimatedInvestment.toLocaleString()}</p>
        {breakdown.challengeCount > 0 && (
          <p className="text-xs text-white/70 mt-1">
            Includes {breakdown.challengeCount} challenge{breakdown.challengeCount !== 1 ? 's' : ''} at ${breakdown.challengeUnitPrice.toLocaleString()}/each
            ({breakdown.challengeTier.slots} slots @ ${breakdown.challengeTier.pricePerPerson}/person)
          </p>
        )}
      </div>

      {/* Matched stage */}
      <div className="bg-white border border-brand-navy/15 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-navy/10">
            <Target className="w-5 h-5 text-brand-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Closest campaign stage</p>
            <p className="font-bold text-gray-800">{stageLabel}</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{matchedStage.intent}</p>
            <p className="text-xs text-gray-400 mt-2">{formatComposition(matchedStage)}</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center px-4">
        Estimate based on our ROI model — your tailored proposal may vary.
      </p>

      {/* ROI button */}
      <Button asChild variant="outline" className="w-full gap-2 border-brand-plum/40 text-brand-plum hover:bg-brand-plum/5">
        <a href={ROI_CALCULATOR_URL} target="_blank" rel="noopener noreferrer">
          See your projected 3-year ROI
          <ExternalLink className="w-4 h-4" />
        </a>
      </Button>
    </div>
  );
}