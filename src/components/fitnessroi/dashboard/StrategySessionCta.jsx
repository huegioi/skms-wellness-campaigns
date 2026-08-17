import React from 'react';
import { Calendar, ExternalLink } from 'lucide-react';

const CALENDLY_URL = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';

export default function StrategySessionCta() {
  return (
    <div className="bg-mf-plum rounded-2xl p-6 text-center shadow-sm">
      {/* !text-white — `.mf h1,h2,h3 { color: plum }` in journeyTheme.css beats
          Tailwind's text-white, which was rendering this heading plum-on-plum. */}
      <h2 className="text-xl font-bold !text-white mb-2">Book your free strategy session</h2>
      <p className="text-sm text-white/80 mb-4 max-w-md mx-auto leading-relaxed">
        We'll walk through your team's results, the gap analysis, and a concrete program plan — no obligation.
      </p>
      <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-[#013f7c] hover:bg-[#012d5a] text-white font-semibold text-sm px-8 py-3 rounded-full shadow-sm transition-colors">
        <Calendar className="w-4 h-4" />
        Book your free strategy session
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}