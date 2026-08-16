import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Pencil, Sparkles, TrendingDown, TrendingUp, Minus,
  HeartHandshake, FlaskConical, DollarSign, ClipboardList,
} from 'lucide-react';
import { computeQuote, CAMPAIGN_STAGES } from '@/lib/rateCard';
import { useRateCard } from '@/lib/useRateCard';
import { useClaimsBenchmarks } from '@/lib/useClaimsBenchmarks';
import { scoreClaimsProfile, CLAIMS_BENCHMARKS } from '@/lib/claimsScoring';
import { CLAIMS_BENCHMARKS as LIVE_BENCHMARKS } from '@/lib/claimsBenchmarks';
import { REFERRAL_BOUNDARY, SUBSCORE_EVIDENCE, HONESTY_RAILS } from './claimsFields';
import { buildClaimsReportPages } from './claimsReportHtml';
import { htmlPagesToPdfDownload } from '@/lib/claimsPdf';

const money = (n) => '$' + Math.round(n).toLocaleString();
const BAND_STYLES = {
  High: 'text-red-700 bg-red-50 border-red-200',
  Elevated: 'text-amber-700 bg-amber-50 border-amber-200',
  Low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

/** The five-section profile output (build plan §6), plus YoY and the EAP what-if. */
export default function ClaimsProfileView({ profile, onBack, onEdit }) {
  useRateCard();
  useClaimsBenchmarks();
  const [whatIfEap, setWhatIfEap] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const r = profile.results || {};
  const subs = r.subscores || {};
  const campaign = r.campaign || {};
  const inputs = profile.inputs || {};
  const headcount = Number(inputs.headcount) || 0;

  const stageInfo = CAMPAIGN_STAGES.find(s => s.stage === campaign.stage) || null;
  const quote = useMemo(() => {
    if (!stageInfo || !headcount) return null;
    try { return computeQuote({ headcount, stage: stageInfo.stage }); } catch { return null; }
  }, [stageInfo, headcount]);

  // ── Year-over-year: any other profile for the same company ──
  const { data: siblings = [] } = useQuery({
    queryKey: ['claimsProfileSiblings', profile.id],
    queryFn: async () => {
      const filter = profile.company_domain
        ? { company_domain: profile.company_domain }
        : { company_name: profile.company_name };
      const rows = await base44.entities.ClaimsProfile.filter(filter, '-report_year', 20);
      return rows.filter(p => p.id !== profile.id && p.report_year && profile.report_year);
    },
  });
  const previous = siblings.find(p => p.report_year < profile.report_year);

  // ── EAP what-if: same engine, EAP raised to benchmark ──
  const whatIf = useMemo(() => {
    if (!whatIfEap) return null;
    const target = LIVE_BENCHMARKS.eapUtilizationBenchmark;
    try {
      return {
        target,
        result: scoreClaimsProfile({ ...inputs, eapUtilization: target }),
      };
    } catch { return null; }
  }, [whatIfEap, inputs]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const pages = buildClaimsReportPages(profile, { quote, stageInfo });
      const yr = profile.report_year ? `_${profile.report_year}` : '';
      await htmlPagesToPdfDownload(pages, `ClaimsInsight_${(profile.company_name || 'report').replace(/[^\w]+/g, '')}${yr}.pdf`);
    } catch (e) {
      toast.error('PDF generation failed: ' + (e?.message || 'unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const prefillQuickBuilder = () => {
    const params = new URLSearchParams({
      headcount: String(headcount || ''),
      stage: String(campaign.stage || ''),
      company: profile.company_name || '',
      from: 'claims',
    });
    window.open(`/QuickBuilder?${params.toString()}`, '_blank');
  };

  const delta = (key) => {
    if (!previous?.results?.subscores?.[key] || subs[key]?.score === null) return null;
    const prev = previous.results.subscores[key].score;
    if (prev === null || prev === undefined) return null;
    return subs[key].score - prev;
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-1">
            <ArrowLeft className="w-4 h-4" /> All profiles
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {profile.company_name}
            {profile.is_demo && <span className="ml-2 text-xs font-bold text-red-500 border border-red-200 rounded px-1.5 py-0.5">DEMO</span>}
          </h2>
          <p className="text-sm text-gray-400">
            {headcount ? `${headcount.toLocaleString()} employees` : ''}{inputs.industry ? ` · ${inputs.industry}` : ''}
            {profile.report_year ? ` · report year ${profile.report_year}` : ''}
            {profile.scored_at ? ` · scored ${new Date(profile.scored_at).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onEdit?.(profile)}><Pencil className="w-4 h-4 mr-1" /> Edit & re-score</Button>
          <Button variant="outline" onClick={downloadPdf} disabled={downloading}>
            <Download className="w-4 h-4 mr-1" /> {downloading ? 'Building…' : '5-page PDF'}
          </Button>
        </div>
      </div>

      {/* ── YoY strip ── */}
      {previous && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-800 mb-1">
            Year over year vs {previous.report_year} — the renewal conversation
          </p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(subs).map(([key, s]) => {
              const d = delta(key);
              if (d === null) return null;
              const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
              // For risk scores, DOWN is good.
              const tone = d < 0 ? 'text-emerald-700' : d > 0 ? 'text-red-700' : 'text-gray-500';
              return (
                <span key={key} className={`flex items-center gap-1 text-xs font-semibold ${tone}`}>
                  <Icon className="w-3.5 h-3.5" /> {s.label.replace(/^\d+\.\s*/, '')}: {d > 0 ? '+' : ''}{d}
                </span>
              );
            })}
          </div>
          <p className="text-[11px] text-blue-700/70 mt-1">
            Movement in the unmet-need gap and EAP reach are the leading claims-side indicators of a working program.
          </p>
        </div>
      )}

      {/* ── 1 · Risk profile ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-gray-400" /> Mental Health Risk Profile</h3>
          <span className={`text-xs font-bold rounded-full border px-2.5 py-1 ${
            r.confidence === 'High' ? BAND_STYLES.Low : r.confidence === 'Moderate' ? BAND_STYLES.Elevated : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
            Confidence: {r.confidence} ({r.fieldsProvided}/{r.fieldsCounted} fields)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(subs).map(s => (
            <div key={s.key} className={`rounded-xl border p-4 ${s.band ? BAND_STYLES[s.band] : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold">{s.label}{s.key === 'unmet_need_gap' && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">flagship</span>}</p>
                <p className="text-2xl font-bold">{s.score ?? '—'}</p>
              </div>
              <p className="text-xs font-semibold mt-0.5">{s.band || 'not in report'}</p>
              <p className="text-xs opacity-75 mt-1.5 leading-relaxed">{s.method}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2 · Hidden cost ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-gray-400" /> The hidden cost</h3>
        {r.hiddenCost ? (
          <>
            <div className="rounded-xl bg-[#f4f0e9] p-5 text-center mb-3">
              <p className="text-3xl font-bold text-[#6b4a35]">{money(r.hiddenCost.low)} – {money(r.hiddenCost.high)}</p>
              <p className="text-xs text-gray-500 mt-1">
                estimated annual presenteeism + absenteeism · {(r.hiddenCost.correctedPrevalence * 100).toFixed(1)}% corrected prevalence
                ≈ {Math.round(r.hiddenCost.affectedEmployees).toLocaleString()} employees
              </p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Max(coded prevalence, AD utilization × depression-attribution) × under-detection correction, capped at 25%;
              × per-case productivity loss (Stewart JAMA 2003; Goetzel 2004), salary-scaled, presented as a 0.7–1.3× range.
              Typically 2–5× the visible BH medical spend. A range, not a promise.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            Not enough fields for the estimate (needs headcount, average salary, and a prevalence proxy).
            Shown as missing rather than $0 — absence of data is not absence of cost.
          </p>
        )}
      </section>

      {/* ── 3 · Recommended campaign ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-gray-400" /> Recommended campaign</h3>
          <Button size="sm" onClick={prefillQuickBuilder} className="bg-gray-900 hover:bg-gray-700">
            Open in Quick Builder →
          </Button>
        </div>
        {stageInfo && (
          <div className="rounded-xl border border-gray-200 p-4 mb-3 bg-[#faf8f4]">
            <p className="font-bold text-[#6b4a35]">Stage {stageInfo.stage} — {stageInfo.name} <span className="font-normal text-gray-400 italic text-sm">· {stageInfo.tagline}</span></p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{campaign.stageRationale}</p>
            {quote && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                {quote.lines.map(l => (
                  <div key={l.key} className="flex justify-between text-sm text-gray-600 py-0.5">
                    <span>{l.label}</span><span className="font-semibold">{money(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 mt-1 border-t border-gray-200">
                  <span>Per campaign</span><span>{money(quote.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          {(campaign.signals || []).map(sig => (
            <details key={sig.key} className="rounded-lg border border-gray-100 px-4 py-2.5">
              <summary className="text-sm font-semibold text-gray-800 cursor-pointer">{sig.label}</summary>
              <p className="text-xs text-gray-400 mt-1.5"><b>Signal:</b> {sig.trigger}</p>
              <p className="text-xs text-gray-600 mt-1"><b>Response:</b> {sig.response}</p>
              <p className="text-xs text-gray-400 mt-1"><b>Mechanism:</b> {sig.mechanism}</p>
            </details>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 italic">
          Sequenced, never a one-off (Fleming 2024); measured with WHO-5/SWEMWBS pulses, reach %, and a next-renewal
          claims re-read. {campaign.expectedOutcomeLanguage}
        </p>
      </section>

      {/* ── 4 · Clinical referral pathway ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2"><HeartHandshake className="w-4 h-4 text-gray-400" /> Clinical referral pathway</h3>
        <p className="text-xs text-gray-400 mb-3">What SkillfulMeans does not treat — its own page in the PDF, deliberately. These route to therapy/EAP, never to programming.</p>
        {(r.referralFlags || []).length > 0 ? (
          <div className="space-y-2 mb-4">
            {r.referralFlags.map(f => (
              <div key={f.key} className={`border-l-4 rounded-r-lg px-3 py-2 text-sm ${f.key === 'eap_reach' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-red-500 bg-red-50 text-red-900'}`}>
                {f.text}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No clinical-severity flags fired on the provided fields.</p>
        )}

        {/* EAP what-if */}
        {inputs.eapUtilization !== undefined && inputs.eapUtilization !== '' && (
          <div className="rounded-xl border border-gray-200 p-4 mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
              <input type="checkbox" checked={whatIfEap} onChange={e => setWhatIfEap(e.target.checked)} />
              What if EAP utilization rose from {(Number(inputs.eapUtilization) * 100).toFixed(1)}% to the {(LIVE_BENCHMARKS.eapUtilizationBenchmark * 100).toFixed(0)}% benchmark?
            </label>
            {whatIf?.result && (
              <p className="text-sm text-gray-600 mt-2">
                Modeled unmet-need gap: <b>{subs.unmetNeedGap?.score ?? '—'}</b> → <b>{whatIf.result.subscores.unmetNeedGap.score ?? '—'}</b>
                {' '}({whatIf.result.subscores.unmetNeedGap.band}). The EAP reach flag clears; identified burden may rise as
                hidden need surfaces — that is detection working, not the program failing.
              </p>
            )}
          </div>
        )}

        <details>
          <summary className="text-sm font-semibold text-gray-600 cursor-pointer">The referral boundary table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-[#f4f0e9] text-[#6b4a35]">
                <th className="text-left p-2">Signal</th><th className="text-left p-2">Belongs with</th><th className="text-left p-2">SkillfulMeans' role</th>
              </tr></thead>
              <tbody>
                {REFERRAL_BOUNDARY.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="p-2 text-gray-700">{row.signal}</td>
                    <td className="p-2 text-gray-700">{row.belongsWith}</td>
                    <td className="p-2 text-gray-500">{row.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="text-[11px] text-gray-400 mt-3">In crisis: call or text 988. SkillfulMeans designs the handoff and never treats.</p>
      </section>

      {/* ── 5 · Method & honesty rails ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3"><FlaskConical className="w-4 h-4 text-gray-400" /> Method & citations</h3>
        <div className="space-y-2 mb-4">
          {SUBSCORE_EVIDENCE.map(e => (
            <details key={e.label} className="rounded-lg border border-gray-100 px-4 py-2">
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer">{e.label}</summary>
              <p className="text-xs text-gray-600 mt-1.5">{e.logic}</p>
              <p className="text-xs text-gray-400 italic mt-1">{e.evidence}</p>
            </details>
          ))}
        </div>
        <div className="rounded-xl bg-[#f4f0e9] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b4a35] mb-1.5">How to read this honestly</p>
          {HONESTY_RAILS.map((rail, i) => (
            <p key={i} className="text-xs text-gray-600 leading-relaxed">• {rail}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
