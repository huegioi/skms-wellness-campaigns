import React from 'react';
import { Lock } from 'lucide-react';

export default function ResultsGate() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-8 text-center shadow-sm">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#fce7f3] flex items-center justify-center">
        <Lock className="w-5 h-5 text-[#4a2040]" />
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-2">Results gate</h3>
      <p className="text-sm text-stone-500">Coming in the next build step.</p>
    </div>
  );
}