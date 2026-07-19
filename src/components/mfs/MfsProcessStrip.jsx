import React from 'react';
import { Users, Share2, Lock, BarChart3 } from 'lucide-react';

const STEPS = [
  { num: 1, icon: Users, label: 'Tell us about your company', sub: '2 minutes' },
  { num: 2, icon: Share2, label: 'Share one link with your team', sub: '3-min survey, fully anonymous' },
  { num: 3, icon: Lock, label: 'Results unlock at 5 responses', sub: 'Privacy threshold' },
  { num: 4, icon: BarChart3, label: 'Review your Score', sub: 'Free strategy session included' },
];

export default function MfsProcessStrip() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 mb-4">
      {/* Desktop: horizontal with connecting line */}
      <div className="hidden md:flex items-start justify-between">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center text-center" style={{ width: '20%' }}>
              <div className="relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#013f7c] text-white font-bold text-base">
                  {step.num}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#264d44] flex items-center justify-center border-2 border-white">
                  <step.icon className="w-3 h-3 text-white" />
                </div>
              </div>
              <p className="font-semibold text-xs text-gray-800 mt-3 leading-tight">{step.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{step.sub}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 flex items-center" style={{ paddingTop: 24 }}>
                <div className="w-full h-px bg-gray-200" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: 2×2 grid */}
      <div className="md:hidden grid grid-cols-2 gap-x-3 gap-y-5">
        {STEPS.map((step) => (
          <div key={step.num} className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#013f7c] text-white font-bold text-sm">
                {step.num}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#264d44] flex items-center justify-center border-2 border-white">
                <step.icon className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <p className="font-semibold text-xs text-gray-800 mt-2 leading-tight">{step.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{step.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}