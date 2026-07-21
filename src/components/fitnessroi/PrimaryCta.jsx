import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Lock } from 'lucide-react';

export default function PrimaryCta({ magicKey }) {
  return (
    <div className="space-y-4">
      <div className="bg-[#4a2040] rounded-2xl p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-white mb-2 leading-snug">
          This score reflects your view. Get the real picture from your team — free.
        </h2>
        <p className="text-sm text-white/70 mb-4 leading-relaxed">
          So far this is one person's perspective. The next step is a free, fully anonymous 3-minute survey for your team — when at least 5 people respond, your dashboard unlocks with your team's real scores and your ROI re-run on measured data.
        </p>
        <Link to={`/FitnessRoi/launch?k=${magicKey}`}
          className="inline-flex items-center gap-2 bg-[#0f766e] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#0d6560] transition-colors mt-2">
          <Rocket className="w-4 h-4" /> Launch your free team assessment
        </Link>
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-stone-200">
        <div className="blur-sm pointer-events-none select-none">
          <div className="bg-white p-5">
            <div className="h-4 w-32 bg-stone-200 rounded mb-3" />
            <div className="h-24 bg-stone-100 rounded mb-3" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 bg-stone-100 rounded" />
              <div className="h-16 bg-stone-100 rounded" />
              <div className="h-16 bg-stone-100 rounded" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
          <div className="text-center">
            <Lock className="w-6 h-6 text-stone-400 mx-auto mb-1" />
            <p className="text-xs text-stone-500 font-medium">Unlocks when your team responds</p>
          </div>
        </div>
      </div>
    </div>
  );
}