import React, { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

export default function MethodologyNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#4a2040]">
          <Info className="w-4 h-4 text-[#0f766e]" /> How to read these numbers
        </span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs text-stone-500 leading-relaxed">
          <p>The quick score was your perception as a leader. The team score is measured from anonymous survey responses.</p>
          <p>Domain shares are directional (ranked, rounded to 5%), based on published research linking each domain to each cost driver.</p>
          <p>Team scores are anonymous aggregates of 5+ responses. Individual answers are never shown to anyone at your company.</p>
        </div>
      )}
    </div>
  );
}