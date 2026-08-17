import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShieldCheck, Calendar, ExternalLink, Lock, ChevronLeft, ChevronDown } from 'lucide-react';
import { scoreClaimsProfile } from '@/lib/claimsScoring';
import CarriedContext from '@/components/warm/CarriedContext';

/**
 * Claims Lite — the public quick read (warming ladder rung 3).
 *
 * Five numbers from a renewal report produce a real risk signal and a
 * hidden-cost range. The FULL five-page report is deliberately not shown
 * here: it is what the visitor gets on the call, which is stated plainly
 * rather than teased.
 *
 * Everything the previous rung learned arrives via ?pass= and is both
 * prefilled AND shown back on screen (CarriedContext) so the visitor can see
 * their own data travelled with them. An existing client is recognised by
 * email domain and never re-enters what we already hold.
 */

const CALENDLY_URL = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';
const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

// The five that move the needle most, in the order a report presents them.
// Findable in about two minutes by someone who has never opened the report.
const FIELDS = [
  { key: 'bhSpendShare', label: 'Behavioral health % of total spend', hint: 'Usually its own line in the service-category breakdown', type: 'percent' },
  { key: 'adUtilization', label: 'Antidepressant utilization (% of members)', hint: 'From the top drug classes — the most complete proxy', type: 'percent' },
  { key: 'erVisitsPer1000', label: 'ER visits per 1,000 members', hint: 'From the utilization section', type: 'number' },
  { key: 'mskTop5', label: 'MSK / back pain in the top 5 diagnoses', hint: 'Yes or no', type: 'yn' },
  { key: 'sleepSignal', label: 'Sleep disorder or sleep-Rx signal', hint: 'Sleep diagnosis in top categories, or a sedative in top drug classes', type: 'yn' },
];

// Everything else the engine reads. Hidden behind an expander so the first
// impression stays a two-minute ask — but someone with the renewal report open
// is never capped at a partial profile. The gate on this tool is the
// INTERPRETATION (the five-page report), never the data entry.
//
// The first six here are the remaining fields the confidence meter counts;
// the rest sharpen the subscores without moving the meter.
const MORE_FIELDS = [
  { key: 'pmpm', label: 'Total paid claims PMPM', hint: 'Total paid ÷ member months — usually on the summary page', type: 'currency', counted: true },
  { key: 'codedPrevalence', label: 'Diagnosed depression/anxiety prevalence', hint: 'Coded prevalence, if the report breaks it out — treated as a floor', type: 'percent', counted: true },
  { key: 'anxiolyticUtilization', label: 'Anxiolytic/sedative utilization', hint: 'From the top drug classes', type: 'percent', counted: true },
  { key: 'psychEvents', label: 'Psych inpatient or behavioral ER events', hint: 'A count. Any number above zero routes to the clinical referral section', type: 'number', counted: true },
  { key: 'hccPctOfSpend', label: 'High-cost claimants: % of total spend', hint: "e.g. 'top 10 claimants = 31% of spend'", type: 'percent', counted: true },
  { key: 'eapUtilization', label: 'EAP utilization', hint: 'From the EAP vendor report, if HR has it', type: 'percent', counted: true },
  { key: 'migraineSignal', label: 'Migraine/headache signal', hint: 'In the top diagnosis categories', type: 'yn' },
  { key: 'giSignal', label: 'GI/functional signal', hint: 'IBS, dyspepsia, functional GI in top categories', type: 'yn' },
  { key: 'cardiometabolicTop5', label: 'Diabetes / cardiometabolic in the top 5', hint: 'Scored through its interaction with depression, not as disease burden', type: 'yn' },
  { key: 'sudPresent', label: 'SUD-related claims present', hint: 'Routes to the referral section', type: 'yn' },
  { key: 'hccBhCondition', label: 'Any high-cost claimant with a behavioral condition', hint: 'Primary or secondary — de-identified summaries usually say', type: 'yn' },
  { key: 'mhDisability', label: 'MH-related STD/LTD claims', hint: 'If a disability report is available', type: 'yn' },
];

const money = (n) => '$' + Math.round(n).toLocaleString();

export default function ClaimsLite() {
  const [searchParams] = useSearchParams();
  const passToken = searchParams.get('pass') || '';
  const ref = searchParams.get('ref') || '';

  const [carried, setCarried] = useState(null);
  const [known, setKnown] = useState(null);
  const [meta, setMeta] = useState({ company_name: '', email: '', headcount: '', avgSalary: '', industry: '' });
  const [raw, setRaw] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [result, setResult] = useState(null);

  // ── Resolve the pass: prefill AND show what carried over ──
  useEffect(() => {
    if (!passToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('resolveHandoffPass', { pass: passToken });
        if (cancelled || !res?.data?.found) return;
        const c = res.data.carried || {};
        const k = res.data.known || null;
        setCarried(c);
        setKnown(k);
        setMeta(m => ({
          ...m,
          company_name: c.company_name || k?.company_name || m.company_name,
          email: c.email || m.email,
          headcount: (c.headcount ?? k?.headcount ?? m.headcount) || '',
          avgSalary: c.avg_salary ?? m.avgSalary,
          industry: c.industry || k?.industry || m.industry,
        }));
      } catch {
        // A bad pass must never block the form — they can still fill it in.
      }
    })();
    return () => { cancelled = true; };
  }, [passToken]);

  const inputs = useMemo(() => {
    const out = {
      headcount: Number(String(meta.headcount).replace(/[^\d.]/g, '')) || null,
      avgSalary: Number(String(meta.avgSalary).replace(/[^\d.]/g, '')) || null,
      industry: meta.industry || null,
    };
    for (const f of [...FIELDS, ...MORE_FIELDS]) {
      const v = raw[f.key];
      if (v === undefined || v === '') continue;
      if (f.type === 'percent') {
        const n = Number(String(v).replace(/[^\d.]/g, ''));
        if (isFinite(n)) out[f.key] = n / 100;
      } else if (f.type === 'number') {
        const n = Number(String(v).replace(/[^\d.]/g, ''));
        if (isFinite(n)) out[f.key] = n;
      } else {
        out[f.key] = v;
      }
    }
    return out;
  }, [meta, raw]);

  // Live preview from the same engine the backend uses.
  const preview = useMemo(() => {
    try { return scoreClaimsProfile(inputs); } catch { return null; }
  }, [inputs]);

  const filled = [...FIELDS, ...MORE_FIELDS].filter(f => raw[f.key] !== undefined && raw[f.key] !== '').length;
  const canSubmit = Number(meta.headcount) > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meta.email) && filled > 0;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submitClaimsLite', {
        inputs,
        company_name: meta.company_name,
        email: meta.email,
        contact_name: carried?.contact_name || undefined,
        pass: passToken || undefined,
        ref: ref || undefined,
      });
      setResult(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not score that — check the numbers and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // One renderer for both field lists — the short one and the expander.
  const renderField = (f) => (
    <div key={f.key} className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mf-ink">{f.label}</p>
        <p className="text-xs text-mf-ink-3">{f.hint}</p>
      </div>
      {f.type === 'yn' ? (
        <select className="h-9 w-36 rounded-md border border-mf-rule bg-white px-2 text-sm shrink-0"
          value={raw[f.key] || ''} onChange={e => setRaw(r => ({ ...r, [f.key]: e.target.value }))}>
          <option value="">— not shown —</option>
          <option value="Y">Yes</option>
          <option value="N">No</option>
        </select>
      ) : (
        <div className="relative shrink-0">
          {f.type === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mf-ink-3">$</span>}
          <Input className={`w-36 text-right ${f.type === 'percent' ? 'pr-7' : ''} ${f.type === 'currency' ? 'pl-7' : ''}`} placeholder="—"
            value={raw[f.key] || ''} onChange={e => setRaw(r => ({ ...r, [f.key]: e.target.value }))} />
          {f.type === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mf-ink-3">%</span>}
        </div>
      )}
    </div>
  );

  const Header = () => (
    <header className="border-b border-black/5 bg-white/60 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-2.5">
        <img src={LOGO_URL} alt="SkillfulMeans" className="h-7 w-auto" />
        <span className="text-[15px] font-semibold tracking-tight text-mf-plum">skillfulmeans</span>
      </div>
    </header>
  );

  // ══════════════ RESULT ══════════════
  if (result) {
    const gap = result.subscores?.unmetNeedGap;
    const shadow = result.subscores?.comorbidityShadow;
    const burden = result.subscores?.identifiedBurden;
    const bandColor = (b) => b === 'High' ? 'text-red-700' : b === 'Elevated' ? 'text-amber-700' : 'text-emerald-700';

    // ── The read, in a sentence or two ──
    // Numbers on their own make a reader do the interpreting. This says what
    // the pattern MEANS, in the order it matters, and stays honest about
    // confidence. It is the short version of page 1 of the full report.
    const summary = (() => {
      const parts = [];
      const hi = (s) => s?.band === 'High';
      const el = (s) => s?.band === 'Elevated';

      if (hi(shadow) || el(shadow)) {
        parts.push(`Your report carries a ${shadow.band.toLowerCase()} stress-linked comorbidity load — the musculoskeletal, sleep and utilization patterns where undiagnosed distress usually surfaces first.`);
      } else if (shadow?.score !== null) {
        parts.push('The stress-linked comorbidity signals in your report are mild — the pattern where undiagnosed distress usually shows up is not pronounced here.');
      }

      if (hi(gap) || el(gap)) {
        parts.push(`Set against that, your behavioural health spend and reach look thin, which is what drives the ${gap.band.toLowerCase()} unmet-need gap. That combination — pressure showing up everywhere except the behavioural health line — is the pattern worth acting on, and it is why a low behavioural health number is not reassurance.`);
      } else if (gap?.score !== null) {
        parts.push('Your behavioural health spend looks proportionate to that load, so the unmet-need gap reads low — care appears to be reaching people rather than being deferred.');
      }

      if (burden?.score !== null && (hi(burden) || el(burden))) {
        parts.push(`Identified burden is ${burden.band.toLowerCase()}, meaning a meaningful share of your population is already in treatment or on medication — a floor, not a ceiling.`);
      }

      if (result.hidden_cost) {
        parts.push(`Taken together, the estimated cost of what this is doing to attendance and performance is ${money(result.hidden_cost.low)}–${money(result.hidden_cost.high)} a year — typically several times what shows on the behavioural health line itself.`);
      }

      parts.push(result.confidence === 'High'
        ? 'Confidence is high: you gave us most of what the model reads.'
        : `Read all of this as a first pass — confidence is ${String(result.confidence).toLowerCase()} at ${result.fields_provided} of ${result.fields_counted} fields, so the range is wider than it needs to be.`);

      return parts.join(' ');
    })();
    return (
      <div className="mf mf-screen min-h-screen">
        <Header />
        <div className="max-w-2xl mx-auto px-5 py-8 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-mf-plum font-semibold mb-1">Your claims quick read</p>
            <h1 className="text-2xl font-bold text-mf-plum">{result.company_name || meta.company_name}</h1>
          </div>

          {/* The headline */}
          {result.hidden_cost ? (
            <div className="mf-card p-6 text-center">
              <p className="text-sm text-mf-ink-2 mb-2">Estimated annual hidden cost — presenteeism and absenteeism</p>
              <p className="text-3xl font-bold text-mf-plum">
                {money(result.hidden_cost.low)} – {money(result.hidden_cost.high)}
              </p>
              <p className="text-xs text-mf-ink-3 mt-2">
                From an estimated {(result.hidden_cost.prevalence * 100).toFixed(1)}% true prevalence, corrected for what claims data is known to miss. A range, not a promise.
              </p>
            </div>
          ) : (
            <div className="mf-card p-6">
              <p className="text-sm text-mf-ink-2">Add an average salary and either diagnosed prevalence or antidepressant utilization and we can estimate the hidden cost. We show it as missing rather than zero — absence of data isn't absence of cost.</p>
            </div>
          )}

          {/* The summary — what the numbers mean, before the numbers themselves */}
          <div className="mf-card p-5 border-l-4 border-l-mf-plum">
            <p className="text-xs uppercase tracking-widest text-mf-plum font-bold mb-2">What this says</p>
            <p className="text-sm text-mf-ink-2 leading-relaxed">{summary}</p>
          </div>

          {/* Two signals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[gap, shadow].filter(Boolean).map(s => (
              <div key={s.key} className="mf-card p-4">
                <p className="text-xs text-mf-ink-3">{s.label.replace(/^\d+\.\s*/, '')}</p>
                <p className="text-2xl font-bold text-mf-plum">{s.score ?? '—'}</p>
                <p className={`text-xs font-semibold ${bandColor(s.band)}`}>{s.band || 'not enough data'}</p>
              </div>
            ))}
          </div>

          {/* Confidence — the honest gap that motivates the call */}
          <div className="mf-card p-5">
            <p className="text-sm font-semibold text-mf-plum mb-1">
              Profile confidence: {result.confidence} — {result.fields_provided} of {result.fields_counted} key fields
            </p>
            <div className="h-2 rounded-full bg-stone-200 overflow-hidden mb-2">
              <div className="h-full rounded-full bg-mf-plum" style={{ width: `${Math.round((result.fields_provided / result.fields_counted) * 100)}%` }} />
            </div>
            {/* Now that the expander lets someone reach 11/11, this line has to
                handle a complete profile — it used to read "0 fields are still
                missing", which made a finished read sound unfinished. */}
            <p className="text-xs text-mf-ink-2 leading-relaxed">
              {result.fields_provided >= result.fields_counted
                ? 'This is as tight as the estimate gets from a report read — you filled in everything the model looks at. The remaining width is the honest uncertainty in the published cost figures, not a gap in your data.'
                : `The range above is this wide because ${result.fields_counted - result.fields_provided} ${result.fields_counted - result.fields_provided === 1 ? 'field is' : 'fields are'} still missing — all of them are in the renewal report you already have.`}
            </p>
          </div>

          {/* What they get on the call — stated, not teased */}
          <div className="bg-mf-plum rounded-2xl p-6 shadow-sm">
            {/* !text-white — `.mf h1,h2,h3 { color: plum }` in journeyTheme.css
                out-specifies Tailwind's text-white on a plum card. */}
            <h2 className="text-lg font-bold !text-white mb-2">Your full report — we'll open it together on the call</h2>
            <p className="text-sm text-white/75 mb-4 leading-relaxed">
              Bring the renewal report and we'll complete the missing fields live. You'll see the whole five-page read on screen during the call, and leave with it:
            </p>
            <ul className="text-sm text-white/90 space-y-1.5 mb-5">
              {[
                'Your Mental Health Risk Profile — four scores, with the reasoning',
                'The hidden cost, narrowed, with the method shown',
                'A recommended campaign sized to your signals, priced',
                'The clinical referral pathway — what belongs with therapy or your EAP, not with us',
                'Methods and citations, so your CFO or broker can check our work',
              ].map(line => (
                <li key={line} className="flex items-start gap-2">
                  <span className="text-mf-mauve mt-0.5">·</span><span>{line}</span>
                </li>
              ))}
            </ul>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-mf-plum font-semibold text-sm px-7 py-3 rounded-full hover:bg-white/90 transition-colors">
              <Calendar className="w-4 h-4" /> Book the 20 minutes <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <p className="text-[11px] text-white/60 mt-3">
              The full read is free. The only gate is a conversation — we'd rather walk you through it than email you a PDF you have to interpret alone.
            </p>
          </div>

          {result.has_clinical_flags && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900 leading-relaxed">
                <b>One thing worth saying now:</b> your report shows clinical-severity signals. Those belong with treatment — your carrier's behavioral health network or your EAP — not with workplace programming. We'll map that handoff on the call, and we'll be clear about what we don't treat.
              </p>
            </div>
          )}

          <p className="text-[11px] text-mf-ink-3 leading-relaxed">
            Population-level inference only — this cannot and does not identify individuals. Claims lag reality by 3–12 months; coded behavioral health prevalence is a floor, never a ceiling. Educational estimates, not medical or actuarial advice.
          </p>
        </div>
      </div>
    );
  }

  // ══════════════ FORM ══════════════
  return (
    <div className="mf mf-screen min-h-screen">
      <Header />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-mf-plum mb-3 leading-tight">What your claims report already knows</h1>
        <p className="text-sm text-mf-ink-2 leading-relaxed mb-5">
          Five numbers from the renewal report you already have. We read them for mental-health risk and estimate what it's costing — in about two minutes, with no file to upload.
        </p>

        {/* The carried data, visible */}
        <CarriedContext carried={carried} known={known} className="mb-5" />

        <div className="mf-card p-6 space-y-5">
          {/* Who they are — prefilled when carried */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-mf-ink-2">Company</label>
              <Input value={meta.company_name} onChange={e => setMeta(m => ({ ...m, company_name: e.target.value }))} placeholder="Acme Manufacturing" />
            </div>
            <div>
              <label className="text-xs font-semibold text-mf-ink-2">Work email</label>
              <Input value={meta.email} onChange={e => setMeta(m => ({ ...m, email: e.target.value }))} placeholder="you@company.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-mf-ink-2">Employees on the plan</label>
              <Input value={meta.headcount} onChange={e => setMeta(m => ({ ...m, headcount: e.target.value }))} placeholder="850" />
            </div>
            <div>
              <label className="text-xs font-semibold text-mf-ink-2">Average annual salary</label>
              <Input value={meta.avgSalary} onChange={e => setMeta(m => ({ ...m, avgSalary: e.target.value }))} placeholder="68,000" />
            </div>
          </div>

          <div className="pt-4 border-t border-mf-rule space-y-4">
            <p className="text-xs uppercase tracking-widest text-mf-ink-3 font-semibold">From the claims report — skip anything it doesn't show</p>
            {FIELDS.map(renderField)}
          </div>

          {/* Nobody with the report open should be capped at a partial read. */}
          <div className="pt-4 border-t border-mf-rule">
            {!showMore ? (
              <button type="button" onClick={() => setShowMore(true)}
                className="w-full flex items-center justify-between text-left group">
                <span>
                  <span className="text-sm font-semibold text-mf-plum">Have the report in front of you? Add the rest.</span>
                  <span className="block text-xs text-mf-ink-3 mt-0.5">
                    {MORE_FIELDS.filter(f => f.counted).length} more fields the confidence meter counts, plus {MORE_FIELDS.filter(f => !f.counted).length} that sharpen the risk read.
                  </span>
                </span>
                <ChevronDown className="w-4 h-4 text-mf-ink-3 group-hover:text-mf-plum shrink-0" />
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-mf-ink-3 font-semibold">Everything else — still all optional</p>
                  <button type="button" onClick={() => setShowMore(false)} className="text-xs text-mf-ink-3 hover:text-mf-plum">Hide</button>
                </div>
                {MORE_FIELDS.map(renderField)}
              </div>
            )}
          </div>

          {/* Live confidence — honest, and it pulls */}
          <div className="pt-4 border-t border-mf-rule">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-mf-plum flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Profile confidence: {preview?.confidence || 'Low'}
              </p>
              <p className="text-xs text-mf-ink-3">{preview?.fieldsProvided ?? 0} of {preview?.fieldsCounted ?? 11} key fields</p>
            </div>
            <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
              <div className="h-full rounded-full bg-mf-plum transition-all"
                style={{ width: `${Math.round(((preview?.fieldsProvided ?? 0) / (preview?.fieldsCounted ?? 11)) * 100)}%` }} />
            </div>
          </div>

          <Button onClick={submit} disabled={!canSubmit || submitting}
            className="w-full bg-mf-plum hover:bg-[#3a1830] text-white rounded-full py-3 font-semibold">
            {submitting ? 'Reading your numbers…' : 'See what my claims say →'}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-mf-ink-3 text-center">Company email, headcount, and at least one claims number.</p>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-xs text-mf-ink-3 mt-4">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Aggregate figures only — numbers and yes/no, never names, member IDs, or files. No individual can be identified from anything on this page.</span>
        </div>
        <a href="/FitnessRoi" className="inline-flex items-center gap-1 text-xs text-mf-ink-3 hover:text-mf-ink-2 mt-4">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to the Mental Fitness Journey
        </a>
      </div>
    </div>
  );
}
