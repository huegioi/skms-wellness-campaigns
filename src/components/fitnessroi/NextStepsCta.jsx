import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Rocket, Lock } from 'lucide-react';
import { startClaimsHandoff } from '@/components/warm/ClaimsHandoffCta';

/**
 * The results-page sidebar after the quick read (2026-09-30 reorder).
 *
 * The assessment now runs estimate → claims → people: each step makes the
 * read more personal (industry averages → their claims → their people).
 * So Step 2 (claims) leads, with a plain skip for anyone without a renewal
 * report, and Step 3 (the team survey) sits right under it. Replaces
 * PrimaryCta, which put the team survey first.
 */
export default function NextStepsCta({ magicKey }) {
  const [busy, setBusy] = useState(false);
  const launchHref = `/FitnessRoi/launch?k=${magicKey}`;

  const goClaims = async () => {
    setBusy(true);
    await startClaimsHandoff(magicKey);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-mf-plum rounded-2xl p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-widest font-bold text-mf-mauve mb-2">Step 2 of 3 · Your claims</p>
        {/* !text-white — `.mf h1,h2,h3 { color: plum }` in journeyTheme.css beats
            Tailwind's text-white on a plum card. */}
        <h2 className="text-lg font-bold !text-white mb-2 leading-snug">
          Check this estimate against your claims.
        </h2>
        <p className="text-sm text-white/75 mb-5 leading-relaxed">
          Five numbers from your renewal report turn it into a cost range. About two minutes, nothing to upload.
        </p>
        <button onClick={goClaims} disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 bg-white text-mf-plum rounded-full px-5 py-3.5 font-semibold shadow-md hover:bg-mf-cream transition-colors disabled:opacity-60">
          {busy ? 'Getting your details…' : 'Add my claims'} <ArrowRight className="w-4 h-4" />
        </button>
        <Link to={launchHref}
          className="block text-center text-xs text-white/75 hover:text-white underline underline-offset-2 mt-3">
          No renewal report handy? Skip to step 3
        </Link>
      </div>

      <div className="mf-card p-6">
        <p className="text-[11px] uppercase tracking-widest font-bold text-mf-ink-3 mb-2">Step 3 of 3 · Your people</p>
        <h2 className="text-lg font-bold text-mf-plum mb-2 leading-snug">
          Then hear from your team — free and anonymous.
        </h2>
        <p className="text-sm text-mf-ink-2 mb-5 leading-relaxed">
          One link, three minutes each. At five responses, their real scores appear beside yours.
        </p>
        <Link to={launchHref}
          className="inline-flex w-full items-center justify-center gap-2 border-2 border-mf-plum text-mf-plum rounded-full px-5 py-3 font-semibold hover:bg-mf-cream transition-colors">
          <Rocket className="w-4 h-4" /> Launch your team survey
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
