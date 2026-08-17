import React from 'react';
import { Users, Share2, Lock, BarChart3 } from 'lucide-react';

export const JOURNEY_STEPS = [
  { num: 1, icon: Users, label: 'Your quick read', sub: '2 min — your estimate' },
  { num: 2, icon: Share2, label: 'Launch team survey', sub: 'One link, 3 min each' },
  { num: 3, icon: Lock, label: 'Results unlock', sub: 'At 5 responses' },
  { num: 4, icon: BarChart3, label: 'See the gap — the cost', sub: 'Estimate vs. reality' },
];

/**
 * The one stage diagram for the Journey. Pass activeStep to light up where the
 * visitor is; omit it and every step renders as plum (the plain explainer).
 * There is deliberately no second, smaller step indicator — one diagram only.
 */
export default function JourneyProcessStrip({ activeStep }) {
  // No activeStep → the static explainer: every step reads as plum.
  const toneFor = (num) => {
    if (!activeStep) return 'on';
    if (num === activeStep) return 'active';
    return num < activeStep ? 'on' : 'future';
  };
  const circle = (tone) => tone === 'future'
    ? 'bg-white border-2 border-gray-200 text-gray-300'
    : 'bg-mf-plum text-white';
  const badge = (tone) => tone === 'future' ? 'bg-gray-200' : 'bg-mf-plum';
  const title = (tone) => tone === 'active' ? 'text-mf-plum' : tone === 'future' ? 'text-gray-400' : 'text-gray-800';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 mb-4">
      {/* Desktop: horizontal with connecting line */}
      <div className="hidden md:flex items-start justify-between">
        {JOURNEY_STEPS.map((step, i) => (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center text-center" style={{ width: '20%' }}>
              <div className="relative">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base transition-colors ${circle(toneFor(step.num))}`}>
                  {step.num}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white transition-colors ${badge(toneFor(step.num))}`}>
                  <step.icon className="w-3 h-3 text-white" />
                </div>
              </div>
              <p className={`font-semibold text-xs mt-3 leading-tight transition-colors ${title(toneFor(step.num))}`}>{step.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{step.sub}</p>
            </div>
            {i < JOURNEY_STEPS.length - 1 && (
              <div className="flex-1 flex items-center" style={{ paddingTop: 24 }}>
                <div className="w-full h-px bg-gray-200" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: 2×2 grid */}
      <div className="md:hidden grid grid-cols-2 gap-x-3 gap-y-5">
        {JOURNEY_STEPS.map((step) => (
          <div key={step.num} className="flex flex-col items-center text-center">
            <div className="relative">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${circle(toneFor(step.num))}`}>
                {step.num}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white transition-colors ${badge(toneFor(step.num))}`}>
                <step.icon className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <p className={`font-semibold text-xs mt-2 leading-tight transition-colors ${title(toneFor(step.num))}`}>{step.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{step.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}