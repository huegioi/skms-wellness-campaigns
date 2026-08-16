import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ShieldCheck, SkipForward, Sparkles } from 'lucide-react';
import { scoreClaimsProfile } from '@/lib/claimsScoring';
import { CLAIMS_BLOCKS } from './claimsFields';

/**
 * The five-block intake wizard (build plan §7.2). Block A is required;
 * every block after it is skippable. A live confidence meter updates as
 * fields fill, setting honest expectations and nudging for missing data.
 * Numbers and picklists ONLY — no uploads, no names, no member IDs, so PHI
 * cannot enter the system even by accident.
 */

// Which missing field would most strengthen the profile, in priority order.
const STRENGTHEN_HINTS = [
  ['adUtilization', 'add Rx data (antidepressant utilization) to strengthen'],
  ['bhSpendShare', 'add behavioral health % of spend to strengthen'],
  ['codedPrevalence', 'add diagnosed prevalence to strengthen'],
  ['eapUtilization', 'add EAP utilization to strengthen'],
  ['erVisitsPer1000', 'add ER utilization to strengthen'],
  ['avgSalary', 'add average salary to unlock the hidden-cost estimate'],
];

function toCanonical(field, raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  if (field.type === 'percent') {
    const n = Number(String(raw).replace(/[%\s,]/g, ''));
    return isFinite(n) ? n / 100 : '';
  }
  if (field.type === 'number' || field.type === 'currency' || field.type === 'rank') {
    const n = Number(String(raw).replace(/[$,\s]/g, ''));
    return isFinite(n) ? n : '';
  }
  return raw; // yn / pick already canonical
}

const ALL_FIELDS = CLAIMS_BLOCKS.flatMap(b => b.fields);

export default function ClaimsIntakeWizard({ existingProfile = null, onScored, onCancel }) {
  const [step, setStep] = useState(0); // 0..4 blocks, 5 = review
  const [meta, setMeta] = useState(() => ({
    company_name: existingProfile?.company_name || '',
    company_domain: existingProfile?.company_domain || '',
    broker_name: existingProfile?.broker_name || '',
    report_year: existingProfile?.report_year || new Date().getFullYear(),
    is_demo: existingProfile?.is_demo || false,
    notes: existingProfile?.notes || '',
  }));
  // Raw display strings, keyed by field key. Canonical inputs derive from these.
  const [raw, setRaw] = useState(() => {
    const out = {};
    const existing = existingProfile?.inputs || {};
    for (const f of ALL_FIELDS) {
      const v = existing[f.key];
      if (v === undefined || v === null || v === '') { out[f.key] = ''; continue; }
      out[f.key] = f.type === 'percent' ? String(Math.round(Number(v) * 1000) / 10) : String(v);
    }
    return out;
  });
  const [saving, setSaving] = useState(false);

  const inputs = useMemo(() => {
    const out = {};
    for (const f of ALL_FIELDS) {
      const v = toCanonical(f, raw[f.key]);
      if (v !== '' && v !== null && v !== undefined) out[f.key] = v;
    }
    return out;
  }, [raw]);

  // Live preview — the same pure engine the backend uses.
  const preview = useMemo(() => {
    try { return scoreClaimsProfile(inputs); } catch { return null; }
  }, [inputs]);

  const headcountOk = Number(inputs.headcount) > 0;
  const companyOk = meta.company_name.trim().length > 0;

  const strengthenHint = useMemo(() => {
    for (const [key, hint] of STRENGTHEN_HINTS) {
      if (inputs[key] === undefined) return hint;
    }
    return null;
  }, [inputs]);

  const block = step < CLAIMS_BLOCKS.length ? CLAIMS_BLOCKS[step] : null;

  const setField = (key, value) => setRaw(r => ({ ...r, [key]: value }));

  const scoreAndSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('scoreClaimsProfile', {
        inputs,
        company_name: meta.company_name.trim(),
        company_domain: meta.company_domain.trim().toLowerCase() || undefined,
        broker_name: meta.broker_name.trim() || undefined,
        report_year: Number(meta.report_year) || undefined,
        notes: meta.notes.trim() || undefined,
        is_demo: meta.is_demo,
        profile_id: existingProfile?.id || undefined,
      });
      toast.success('Profile scored and saved.');
      onScored?.(res.data.profile);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Scoring failed.');
    } finally {
      setSaving(false);
    }
  };

  const confColor = preview?.confidence === 'High' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : preview?.confidence === 'Moderate' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-gray-600 bg-gray-50 border-gray-200';

  const renderField = (f) => {
    // Conditional fields (e.g. MSK rank only when MSK = Yes)
    if (f.showIf && raw[f.showIf.key] !== f.showIf.equals) return null;
    const common = 'w-40 text-right';
    return (
      <div key={f.key} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">
            {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
          </p>
          {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
        </div>
        {f.type === 'yn' && (
          <select
            className="h-9 w-40 rounded-md border border-gray-200 bg-white px-2 text-sm"
            value={raw[f.key] || ''}
            onChange={e => setField(f.key, e.target.value)}
          >
            <option value="">— not in report —</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
          </select>
        )}
        {f.type === 'rank' && (
          <select
            className="h-9 w-40 rounded-md border border-gray-200 bg-white px-2 text-sm"
            value={raw[f.key] || ''}
            onChange={e => setField(f.key, e.target.value)}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {f.type === 'pick' && (
          <select
            className="h-9 w-52 rounded-md border border-gray-200 bg-white px-2 text-sm"
            value={raw[f.key] || ''}
            onChange={e => setField(f.key, e.target.value)}
          >
            <option value="">—</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {(f.type === 'number' || f.type === 'currency' || f.type === 'percent') && (
          <div className="relative">
            {f.type === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>}
            <Input
              type="text"
              inputMode="decimal"
              className={`${common} ${f.type === 'currency' ? 'pl-7' : ''} ${f.type === 'percent' ? 'pr-7' : ''}`}
              placeholder="—"
              value={raw[f.key] || ''}
              onChange={e => setField(f.key, e.target.value)}
            />
            {f.type === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl">
      {/* ── Confidence meter — always visible ── */}
      <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 mb-5 ${confColor}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="w-4 h-4" />
          Profile confidence: {preview?.confidence || 'Low'}
          <span className="font-normal opacity-70">
            ({preview?.fieldsProvided ?? 0} of {preview?.fieldsCounted ?? 11} key fields)
          </span>
        </div>
        {strengthenHint && (
          <p className="text-xs opacity-80 text-right">{strengthenHint}</p>
        )}
      </div>

      {/* ── Step chips ── */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {CLAIMS_BLOCKS.map((b, i) => (
          <button
            key={b.key}
            onClick={() => setStep(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              i === step ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {b.key}{b.required ? '' : ''} · {b.title.split('— ')[1]}
          </button>
        ))}
        <button
          onClick={() => setStep(5)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            step === 5 ? 'bg-gray-900 text-white'
            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Review & score
        </button>
      </div>

      {block && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="font-bold text-gray-900">{block.title}{block.required && <span className="text-red-500 ml-1">*</span>}</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{block.why}</p>
          </div>

          {/* Company details live with Block A */}
          {block.key === 'A' && (
            <div className="mb-5 pb-4 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Company name *</p>
                <Input value={meta.company_name} onChange={e => setMeta(m => ({ ...m, company_name: e.target.value }))} placeholder="Acme Manufacturing" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Company email domain</p>
                <Input value={meta.company_domain} onChange={e => setMeta(m => ({ ...m, company_domain: e.target.value }))} placeholder="acme.com — links to the Client record" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Broker / HR contact</p>
                <Input value={meta.broker_name} onChange={e => setMeta(m => ({ ...m, broker_name: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Report year</p>
                <Input type="number" value={meta.report_year} onChange={e => setMeta(m => ({ ...m, report_year: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
                <input type="checkbox" checked={meta.is_demo} onChange={e => setMeta(m => ({ ...m, is_demo: e.target.checked }))} />
                Demo profile (fake company — kept out of analytics)
              </label>
            </div>
          )}

          <div>{block.fields.map(renderField)}</div>

          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => (step === 0 ? onCancel?.() : setStep(s => s - 1))}>
              <ChevronLeft className="w-4 h-4 mr-1" /> {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            <div className="flex items-center gap-2">
              {!block.required && (
                <Button variant="outline" onClick={() => setStep(s => s + 1)}>
                  <SkipForward className="w-4 h-4 mr-1" /> Skip — report doesn't have this
                </Button>
              )}
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={block.key === 'A' && (!headcountOk || !companyOk)}
                className="bg-gray-900 hover:bg-gray-700"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
          {block.key === 'A' && (!headcountOk || !companyOk) && (
            <p className="text-xs text-amber-600 mt-2 text-right">Company name and headcount are the only required fields.</p>
          )}
        </div>
      )}

      {/* ── Review & score ── */}
      {step === 5 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-1">Review & score</h3>
          <p className="text-xs text-gray-400 mb-4">
            {Object.keys(inputs).length} fields entered for {meta.company_name || '—'} ({meta.report_year}).
            Blank fields degrade confidence honestly — they never fake a zero.
          </p>

          {preview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {Object.values(preview.subscores).map(s => (
                <div key={s.key} className="rounded-xl border border-gray-100 p-3 text-center">
                  <p className="text-[11px] text-gray-400 leading-tight h-7">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.score ?? '—'}</p>
                  <p className={`text-xs font-semibold ${
                    s.band === 'High' ? 'text-red-600' : s.band === 'Elevated' ? 'text-amber-600'
                    : s.band === 'Low' ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {s.band || 'no data'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">Notes (which carrier report, what was missing…)</p>
            <Textarea rows={2} value={meta.notes} onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))} />
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(4)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button
              onClick={scoreAndSave}
              disabled={saving || !headcountOk || !companyOk}
              className="bg-gray-900 hover:bg-gray-700"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              {saving ? 'Scoring…' : existingProfile ? 'Re-score & update profile' : 'Score & save profile'}
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
        Aggregate, de-identified report fields only — this form takes numbers and picklists, never names,
        member IDs, or claim-line files. No individual identification is possible or attempted.
      </p>
    </div>
  );
}
