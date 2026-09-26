import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Phone-only bar pinned to the bottom of the screen with the step's Back and
 * primary action. On steps 2 and 3 the inline buttons sit one to three
 * screens below the thing you just tapped (a tier card, the gallery), so on a
 * phone the next move was always "scroll and hunt". From `sm` up it renders
 * nothing and the inline buttons take over, so desktop is unchanged.
 *
 * Render <MobileActionBarSpacer /> at the end of the page so the last content
 * isn't hidden behind the bar.
 */
export default function MobileActionBar({ onBack, backDisabled, summary, children }) {
  return (
    <div
      className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur
                 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      {summary && <div className="mb-2 text-xs text-gray-500 truncate">{summary}</div>}
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            aria-label="Back"
            className="h-12 w-12 flex-shrink-0 rounded-xl border border-gray-200 bg-white flex items-center
                       justify-center text-gray-700 disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0 [&>button]:w-full [&>button]:h-12 [&>button]:text-base">{children}</div>
      </div>
    </div>
  );
}

export function MobileActionBarSpacer({ withSummary = false }) {
  return <div aria-hidden className={`sm:hidden ${withSummary ? 'h-32' : 'h-24'}`} />;
}
