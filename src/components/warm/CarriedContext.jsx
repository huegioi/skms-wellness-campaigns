import React from 'react';
import { ArrowRight, CheckCircle2, Building2 } from 'lucide-react';

/**
 * The visible half of the handoff.
 *
 * Carrying data silently isn't enough — a visitor has to SEE that what they
 * just entered came with them, or the next form feels like starting over
 * (William, 2026-08-17). This strip shows a few of the facts we already hold,
 * names where they came from, and says plainly that they're already filled in.
 *
 * Two states:
 *   · carried   — "From your Mental Fitness Journey: 850 employees · $68,000 …"
 *   · known     — an EXISTING CLIENT: "Welcome back, Meridian Foods" plus what
 *                 we have on file, so a current client never re-enters details.
 *
 * Deliberately small: a strip, never a panel. It reassures; it isn't the page.
 */

const money = (n) => '$' + Math.round(Number(n)).toLocaleString();

export function buildCarriedFacts(carried) {
  if (!carried) return [];
  const facts = [];
  if (carried.company_name) facts.push({ label: 'Company', value: carried.company_name });
  if (carried.headcount) facts.push({ label: 'Employees', value: Number(carried.headcount).toLocaleString() });
  if (carried.avg_salary) facts.push({ label: 'Avg salary', value: money(carried.avg_salary) });
  if (carried.industry) facts.push({ label: 'Industry', value: carried.industry });
  return facts;
}

export default function CarriedContext({ carried, known, className = '' }) {
  const facts = buildCarriedFacts(carried);
  const highlights = Array.isArray(carried?.highlights) ? carried.highlights : [];
  const isReturningClient = known?.is_current_client === true;

  if (facts.length === 0 && highlights.length === 0 && !isReturningClient) return null;

  return (
    <div className={`rounded-xl border border-mf-rule bg-white/70 px-4 py-3 ${className}`}>
      {/* Where it came from */}
      <div className="flex items-center gap-1.5 mb-2">
        {isReturningClient
          ? <Building2 className="w-3.5 h-3.5 text-mf-plum shrink-0" />
          : <CheckCircle2 className="w-3.5 h-3.5 text-mf-plum shrink-0" />}
        <p className="text-[11px] uppercase tracking-widest font-bold text-mf-plum">
          {isReturningClient
            ? `We already have ${known.company_name || 'your organization'} on file`
            : carried?.from_label
              ? `Carried over from your ${carried.from_label}`
              : 'Carried over'}
        </p>
      </div>

      {/* The facts themselves — the point of the strip */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {facts.map(f => (
          <span key={f.label} className="text-xs text-mf-ink-2">
            {f.label}: <b className="text-mf-plum font-semibold">{f.value}</b>
          </span>
        ))}
        {highlights.map(h => (
          <span key={h.label} className="text-xs text-mf-ink-2">
            {h.label}: <b className="text-mf-plum font-semibold">{h.value}</b>
          </span>
        ))}
      </div>

      {/* What that means for them right now */}
      <p className="text-[11px] text-mf-ink-3 mt-2 leading-relaxed">
        {isReturningClient
          ? <>Already filled in below{known?.last_claims_year ? ` — your last claims read was ${known.last_claims_year}` : ''}. Anything changed? Just edit it.</>
          : <>Already filled in below — you only need the numbers from your claims report.</>}
      </p>
    </div>
  );
}

/** Compact inline variant for a CTA card: "Takes your 850 employees with you". */
export function CarryPromise({ carried, className = '' }) {
  const facts = buildCarriedFacts(carried);
  if (facts.length === 0) return null;
  const shown = facts.slice(0, 3).map(f => f.value).join(' · ');
  return (
    <p className={`text-xs opacity-80 flex items-center gap-1.5 ${className}`}>
      <ArrowRight className="w-3 h-3 shrink-0" />
      <span>Comes with you: {shown}</span>
    </p>
  );
}
