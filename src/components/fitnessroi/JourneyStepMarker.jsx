import React from 'react';
import { JOURNEY_STEPS } from './JourneyProcessStrip';

export default function JourneyStepMarker({ activeStep }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      {JOURNEY_STEPS.map((step, i) => {
        const isActive = step.num === activeStep;
        const isPast = step.num < activeStep;
        return (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center" style={{ width: '22%' }}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive
                    ? 'bg-[#4a2040] border-[#4a2040] text-white'
                    : isPast
                      ? 'bg-[#0f766e] border-[#0f766e] text-white'
                      : 'bg-white border-gray-200 text-gray-300'
                }`}
              >
                <step.icon className="w-3.5 h-3.5" />
              </div>
              <p className={`text-[9px] mt-1 leading-tight text-center ${isActive ? 'font-semibold text-[#4a2040]' : 'text-gray-400'}`}>
                {step.label}
              </p>
            </div>
            {i < JOURNEY_STEPS.length - 1 && (
              <div className={`flex-1 h-px ${isPast ? 'bg-[#0f766e]' : 'bg-gray-200'}`} style={{ marginTop: -10 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}