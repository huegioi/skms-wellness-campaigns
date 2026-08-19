import React from 'react';
import { Lock } from 'lucide-react';
import JourneyScoreDial from '@/components/fitnessroi/JourneyScoreDial';

/**
 * A small facsimile of the results dashboard, shown on the Journey's first
 * screen so a buyer can see what they get before answering anything.
 *
 * Built in markup from the real dial component rather than shipped as a
 * screenshot: a PNG would be stale the first time the results page changes, and
 * this stays sharp on any display. Every figure is illustrative and the caption
 * says so — nothing here reads from a real journey.
 */
const DOMAINS = [
  { label: 'Wellbeing', score: 68 },
  { label: 'Stress', score: 54 },
  { label: 'Engagement', score: 71 },
  { label: 'Connection', score: 49 },
];

export default function JourneyDashboardTeaser() {
  return (
    <figure className="m-0">
      <div className="relative rounded-2xl border border-mf-rule bg-white shadow-xl overflow-hidden">
        {/* Window chrome, so this reads as a screenshot of something rather than
            as more page furniture. */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-mf-rule bg-mf-cream/70">
          <span className="w-2 h-2 rounded-full bg-mf-rule" />
          <span className="w-2 h-2 rounded-full bg-mf-rule" />
          <span className="w-2 h-2 rounded-full bg-mf-rule" />
          <span className="ml-1.5 text-[9px] uppercase tracking-[0.12em] text-mf-ink-3">Your team dashboard</span>
        </div>

        <div className="p-4">
          <p className="mf-serif text-[13px] text-mf-plum mb-3">Your Mental Fitness Snapshot</p>

          <div className="flex items-center gap-4">
            <JourneyScoreDial score={61} size={132} />
            <div className="flex-1 space-y-2.5">
              {DOMAINS.map(d => (
                <div key={d.label}>
                  <div className="flex justify-between text-[10px] leading-none mb-1">
                    <span className="text-mf-ink-2">{d.label}</span>
                    <span className="font-semibold text-mf-plum tabular-nums">{d.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-mf-grid overflow-hidden">
                    <div className="h-full rounded-full bg-mf-plum" style={{ width: `${d.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-mf-plum px-4 py-3 text-white">
            <p className="text-[9px] uppercase tracking-[0.1em] opacity-60">Estimated annual value</p>
            <p className="mf-serif text-[24px] leading-none my-1 tabular-nums">$103,651</p>
            <p className="text-[10px] opacity-70">recovered time · absence · retention · healthcare</p>
          </div>

          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-mf-rule py-2">
            <Lock className="w-3 h-3 text-mf-ink-3 shrink-0" />
            <span className="text-[10px] text-mf-ink-3">Team comparison unlocks when 5 people respond</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-[11px] italic text-mf-ink-3">
        An example dashboard. Yours is built from your own numbers.
      </figcaption>
    </figure>
  );
}
