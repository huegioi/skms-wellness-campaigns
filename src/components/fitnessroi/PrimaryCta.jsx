import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Lock } from 'lucide-react';

export default function PrimaryCta({ magicKey }) {
  return (
    <div className="space-y-4">
      <div className="bg-mf-plum rounded-2xl p-6 text-center shadow-sm">
        {/* !text-white — `.mf h1,h2,h3 { color: plum }` in journeyTheme.css beats
            Tailwind's text-white, which was rendering this heading plum-on-plum. */}
        <h2 className="text-lg font-bold !text-white mb-2 leading-snug">
          This score reflects your view. Get the real picture from your team — free.
        </h2>
        <p className="text-sm text-white/70 mb-5 leading-relaxed">
          So far this is one person's perspective. The next step is a free, fully anonymous 3-minute survey for your team — when at least 5 people respond, your dashboard unlocks with your team's real scores and your ROI re-run on measured data.
        </p>
        {/* A WHITE pill, not plum-on-plum: the old bg-mf-plum button was the same
            colour as the card it sits on, so it read as a line of text rather
            than something to click. */}
        <Link to={`/FitnessRoi/launch?k=${magicKey}`}
          className="inline-flex w-full items-center justify-center gap-2 bg-white text-mf-plum rounded-full px-5 py-3.5 font-semibold shadow-md hover:bg-mf-cream transition-colors">
          <Rocket className="w-4 h-4" /> Launch your free team assessment
        </Link>
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-mf-rule">
        <div className="blur-sm pointer-events-none select-none">
          <div className="bg-white p-5">
            <div className="h-4 w-32 bg-stone-200 rounded mb-3" />
            <div className="h-24 bg-mf-cream rounded mb-3" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 bg-mf-cream rounded" />
              <div className="h-16 bg-mf-cream rounded" />
              <div className="h-16 bg-mf-cream rounded" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
          <div className="text-center">
            <Lock className="w-6 h-6 text-mf-ink-3 mx-auto mb-1" />
            <p className="text-xs text-mf-ink-2 font-medium">Unlocks when your team responds</p>
          </div>
        </div>
      </div>
    </div>
  );
}