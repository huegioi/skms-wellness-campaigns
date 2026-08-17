import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { CarryPromise } from '@/components/warm/CarriedContext';

/**
 * The Journey → Claims Lite handoff (warming ladder rung 2 → 3).
 *
 * The Journey's number is built from PERCEPTION — the leader's read plus the
 * team's anonymous responses. Persuasive, but self-reported. Claims data is
 * the hard-money second witness, which is the whole pitch of this card.
 *
 * Clicking mints a HandoffPass server-side and moves to Claims Lite with only
 * an opaque token in the URL. The card also states, visibly, which facts are
 * travelling — carrying data silently isn't enough.
 */
export default function ClaimsHandoffCta({
  magicKey, companyName, headcount, avgSalary, industry, highlights = [],
}) {
  const [busy, setBusy] = useState(false);

  const carried = {
    company_name: companyName || null,
    headcount: headcount || null,
    avg_salary: avgSalary || null,
    industry: industry || null,
    highlights,
  };

  const go = async () => {
    setBusy(true);
    try {
      // Only the magic key and the display highlights travel. Company, email,
      // headcount, salary, industry, broker ref and demo flag are read from the
      // Journey record server-side.
      const res = await base44.functions.invoke('createHandoffPass', {
        source: 'journey',
        journey_magic_key: magicKey || undefined,
        payload: { highlights },
      });
      const pass = res?.data?.pass;
      window.location.href = pass ? `/ClaimsLite?pass=${pass}` : '/ClaimsLite';
    } catch {
      // Never trap them here — the form works without a pass, they just retype.
      window.location.href = '/ClaimsLite';
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-mf-plum rounded-2xl p-6 shadow-sm">
      <p className="text-[11px] uppercase tracking-widest font-bold text-mf-mauve mb-2">The other witness</p>
      {/* !text-white: journeyTheme.css sets `.mf h1,h2,h3 { color: plum }`,
          which out-specifies Tailwind's text-white and renders headings
          invisible on a plum card. The bang wins it back. */}
      <h2 className="text-xl font-bold !text-white mb-2 leading-snug">
        Your team named the gap. Your claims show the bill.
      </h2>
      <p className="text-sm text-white/75 mb-4 leading-relaxed">
        What you've seen so far is how your people feel. Your renewal claims report is the same story in dollars —
        and it's the version a CFO can't wave off. Five numbers, about two minutes.
      </p>
      <button onClick={go} disabled={busy}
        className="inline-flex items-center gap-2 bg-white text-mf-plum font-semibold text-sm px-7 py-3 rounded-full hover:bg-white/90 transition-colors disabled:opacity-60">
        {busy ? 'Getting your details…' : 'See what my claims say'} <ArrowRight className="w-4 h-4" />
      </button>
      <CarryPromise carried={carried} className="text-white/70 mt-3" />
    </div>
  );
}
