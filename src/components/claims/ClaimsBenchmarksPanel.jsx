import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, RotateCcw, Save, History, Check } from 'lucide-react';
import {
  currentClaimsBenchmarks, defaultClaimsBenchmarks, applyClaimsBenchmarkOverrides,
  resetClaimsBenchmarks, validateClaimsBenchmarkInput, verifyClaimsBenchmarkIntegrity,
} from '@/lib/claimsBenchmarks';
import { scoreClaimsProfile, verifyClaimsScoring, WORKSHEET_EXAMPLE_INPUTS } from '@/lib/claimsScoring';
import { invalidateClaimsBenchmarks } from '@/lib/useClaimsBenchmarks';

/**
 * The claims-benchmark editor — same guarded-save architecture as the Rate
 * Card tab: shipped defaults in code, overrides in ClaimsBenchmarkSetting,
 * validation + integrity checks that refuse a bad save, live preview of the
 * worksheet example company, and a history audit trail.
 */

const LABELS = {
  adUtilizationBenchmark: ['Antidepressant utilization benchmark', 'CDC/NCHS: 13.2% of US adults; enter 0.13 for 13%'],
  anxiolyticBenchmark: ['Anxiolytic/sedative benchmark', 'Assumption — calibrate against real reports'],
  bhSpendShareBenchmark: ['Behavioral health % of spend benchmark', 'Typical commercial book 4–5%; Milliman found 4.4%'],
  codedPrevalenceBenchmark: ['Coded depression/anxiety prevalence benchmark', 'A floor — claims under-detect (Fiest 2014)'],
  erVisitsPer1000Benchmark: ['ER visits per 1,000 members benchmark', 'Assumption — calibrate'],
  eapUtilizationBenchmark: ['EAP utilization benchmark', 'Industry norm 2–8%; low use = reach failure'],
  underDetectionFactor: ['Under-detection correction factor', 'Applied to observed prevalence; result capped below'],
  prevalenceCap: ['Corrected prevalence cap', '0.25 = corrected prevalence never exceeds 25%'],
  productivityLossPerCase: ['Annual productivity loss per affected employee', 'Stewart JAMA 2003 + Goetzel 2004, at the reference salary'],
  referenceSalary: ['Reference salary for the constant above', 'Cost scales linearly with the client average salary'],
  hiddenCostLowMultiplier: ['Hidden-cost range: low multiplier', 'The estimate is a range, never a point'],
  hiddenCostHighMultiplier: ['Hidden-cost range: high multiplier', ''],
  adDepressionAttribution: ['AD → depression attribution factor', 'Only ~55–70% of AD use treats depression (Gardarsdottir)'],
  identifiedBurdenScale: ['Identified-burden scale', 'Benchmark-ratio average × this = the 0–100 score'],
  anxiolyticExcessPoints: ['Points: anxiolytics above benchmark', ''],
  trdPatternPoints: ['Points: TRD pattern', ''],
  unmetNeedBhWeight: ['Unmet-need weight: BH spend thinness', 'The flagship subscore'],
  unmetNeedEapWeight: ['Unmet-need weight: EAP reach thinness', ''],
  unmetNeedAmplifier: ['Unmet-need amplifier', ''],
  weightMsk: ['Shadow weight: MSK / back pain', 'Weights should stay near a sum of 100'],
  mskTopRankBonus: ['Bonus: MSK ranked 1–2', ''],
  weightSleep: ['Shadow weight: sleep signal', ''],
  weightMigraine: ['Shadow weight: migraine/headache', ''],
  weightGi: ['Shadow weight: GI/functional', ''],
  weightCardiometabolic: ['Shadow weight: cardiometabolic', ''],
  weightErAboveBenchmark: ['Shadow weight: ER above benchmark', ''],
  flagPsychEventsPoints: ['Flag points: psych inpatient / behavioral ER', 'Any hit routes to referral, always'],
  flagSudPoints: ['Flag points: SUD-related claims', ''],
  flagHccBhPoints: ['Flag points: high-cost claimant with BH', ''],
  flagStdLtdPoints: ['Flag points: MH-related STD/LTD', ''],
  bandLowElevated: ['Band cutoff: Low / Elevated', 'Scores below this read Low'],
  bandElevatedHigh: ['Band cutoff: Elevated / High', 'Scores above this read High'],
  confidenceHighMin: ['Confidence: fields needed for High', 'Of the 11 counted report fields'],
  confidenceModerateMin: ['Confidence: fields needed for Moderate', ''],
};

const GROUPS = [
  { title: 'Population benchmarks', keys: ['adUtilizationBenchmark', 'anxiolyticBenchmark', 'bhSpendShareBenchmark', 'codedPrevalenceBenchmark', 'erVisitsPer1000Benchmark', 'eapUtilizationBenchmark'] },
  { title: 'Hidden-cost constants', keys: ['underDetectionFactor', 'prevalenceCap', 'productivityLossPerCase', 'referenceSalary', 'hiddenCostLowMultiplier', 'hiddenCostHighMultiplier', 'adDepressionAttribution'] },
  { title: 'Subscore 1 — identified burden', keys: ['identifiedBurdenScale', 'anxiolyticExcessPoints', 'trdPatternPoints'] },
  { title: 'Subscore 2 — unmet-need gap (flagship)', keys: ['unmetNeedBhWeight', 'unmetNeedEapWeight', 'unmetNeedAmplifier'] },
  { title: 'Subscore 3 — comorbidity-shadow weights', keys: ['weightMsk', 'mskTopRankBonus', 'weightSleep', 'weightMigraine', 'weightGi', 'weightCardiometabolic', 'weightErAboveBenchmark'] },
  { title: 'Subscore 4 — clinical-severity flags', keys: ['flagPsychEventsPoints', 'flagSudPoints', 'flagHccBhPoints', 'flagStdLtdPoints'] },
  { title: 'Bands & confidence', keys: ['bandLowElevated', 'bandElevatedHigh', 'confidenceHighMin', 'confidenceModerateMin'] },
];

export default function ClaimsBenchmarksPanel() {
  const qc = useQueryClient();
  const defaults = useMemo(() => defaultClaimsBenchmarks(), []);

  const { data: activeRecord, isLoading } = useQuery({
    queryKey: ['claimsBenchmarkSetting'],
    queryFn: async () => {
      const rows = await base44.entities.ClaimsBenchmarkSetting.filter({ is_active: true }, '-updated_at', 1);
      return rows?.[0] || null;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['claimsBenchmarkHistory'],
    queryFn: () => base44.entities.ClaimsBenchmarkSetting.list('-updated_at', 15),
  });

  const [draft, setDraft] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isLoading) return;
    resetClaimsBenchmarks();
    applyClaimsBenchmarkOverrides(activeRecord?.overrides);
    setDraft(currentClaimsBenchmarks());
  }, [activeRecord, isLoading]);

  const setValue = (key, raw) =>
    setDraft(d => ({ ...d, values: { ...d.values, [key]: raw === '' ? '' : Number(raw) } }));

  // Validation + example-company preview on every keystroke, draft only.
  const { inputProblems, integrityProblems, preview, worksheetDrift } = useMemo(() => {
    if (!draft) return { inputProblems: [], integrityProblems: [], preview: null, worksheetDrift: [] };
    const inputProblems = validateClaimsBenchmarkInput(draft);
    if (inputProblems.length) return { inputProblems, integrityProblems: [], preview: null, worksheetDrift: [] };
    const integrityProblems = verifyClaimsBenchmarkIntegrity(draft);

    const snapshot = currentClaimsBenchmarks();
    resetClaimsBenchmarks();
    applyClaimsBenchmarkOverrides(draft);
    const preview = scoreClaimsProfile(WORKSHEET_EXAMPLE_INPUTS);
    const worksheetDrift = verifyClaimsScoring();
    resetClaimsBenchmarks();
    applyClaimsBenchmarkOverrides(snapshot);

    return { inputProblems, integrityProblems, preview, worksheetDrift };
  }, [draft]);

  const changedKeys = useMemo(() => {
    if (!draft) return [];
    const out = [];
    for (const [k, v] of Object.entries(draft.values)) {
      if (Number(v) !== Number(defaults.values[k])) out.push(`${LABELS[k]?.[0] || k}: ${defaults.values[k]} → ${v}`);
    }
    return out;
  }, [draft, defaults]);

  const blocked = inputProblems.length > 0 || integrityProblems.length > 0;

  const save = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me().catch(() => null);
      // Supersede rather than overwrite, so history survives.
      for (const row of history.filter(h => h.is_active)) {
        await base44.entities.ClaimsBenchmarkSetting.update(row.id, { is_active: false });
      }
      return base44.entities.ClaimsBenchmarkSetting.create({
        is_active: true,
        overrides: draft,
        note: note.trim() || undefined,
        changed_summary: changedKeys,
        updated_by: user?.email,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      invalidateClaimsBenchmarks();
      resetClaimsBenchmarks();
      applyClaimsBenchmarkOverrides(draft);
      setNote('');
      qc.invalidateQueries({ queryKey: ['claimsBenchmarkSetting'] });
      qc.invalidateQueries({ queryKey: ['claimsBenchmarkHistory'] });
      toast.success('Benchmarks saved. Every new scoring run uses these values now.');
    },
    onError: (e) => toast.error(e?.message || 'Could not save the benchmarks.'),
  });

  if (isLoading || !draft) {
    return <div className="py-8 text-gray-400">Loading the benchmarks…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-lg font-bold text-gray-800">Scoring benchmarks</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
          Every constant the Claims Insight engine uses lives here — benchmarks, weights, band cutoffs, cost figures.
          The Phase 1 goal is calibration: as real broker reports come in, adjust these and note which report drove the change.
          Saved profiles keep the benchmarks they were scored with, so history never silently changes.
        </p>
      </div>

      {inputProblems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800"><AlertTriangle className="w-4 h-4" /> Fix these before saving</p>
          <ul className="mt-2 space-y-1">{inputProblems.map((p, i) => <li key={i} className="text-sm text-red-700">• {p}</li>)}</ul>
        </div>
      )}
      {integrityProblems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800"><AlertTriangle className="w-4 h-4" /> These values break the scoring rules — saving is blocked</p>
          <ul className="mt-2 space-y-1">{integrityProblems.map((p, i) => <li key={i} className="text-sm text-red-700">• {p}</li>)}</ul>
        </div>
      )}

      {/* Live preview — the worksheet example company under the draft */}
      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
            Live preview — the worksheet's 850-person example under these values
          </p>
          <div className="flex flex-wrap gap-4">
            {Object.values(preview.subscores).map(s => (
              <span key={s.key} className="text-sm text-gray-700">
                {s.label.replace(/^\d+\.\s*/, '')}: <b>{s.score ?? '—'}</b>
                <span className={`ml-1 text-xs font-semibold ${s.band === 'High' ? 'text-red-600' : s.band === 'Elevated' ? 'text-amber-600' : 'text-emerald-600'}`}>{s.band}</span>
              </span>
            ))}
            {preview.hiddenCost && (
              <span className="text-sm text-gray-700">
                Hidden cost: <b>${Math.round(preview.hiddenCost.low).toLocaleString()}–${Math.round(preview.hiddenCost.high).toLocaleString()}</b>
              </span>
            )}
          </div>
          <p className={`text-xs mt-2 ${worksheetDrift.length ? 'text-amber-600' : 'text-emerald-600'}`}>
            {worksheetDrift.length
              ? `Departs from the Phase 1 worksheet defaults (expected when calibrating): ${worksheetDrift.length} value(s) differ.`
              : 'Matches the Phase 1 worksheet exactly.'}
          </p>
        </div>
      )}

      {GROUPS.map(group => (
        <div key={group.title} className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-gray-800 mb-1">{group.title}</p>
          {group.keys.map(key => (
            <div key={key} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{LABELS[key]?.[0] || key}</p>
                {LABELS[key]?.[1] && <p className="text-xs text-gray-400">{LABELS[key][1]}</p>}
              </div>
              <Input
                type="number" step="any" className="w-32 text-right"
                value={draft.values[key]}
                onChange={e => setValue(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {changedKeys.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Changing vs shipped defaults</p>
            {changedKeys.map((c, i) => <p key={i} className="text-xs text-gray-600">• {c}</p>)}
          </div>
        )}
        <Textarea
          rows={2} value={note} onChange={e => setNote(e.target.value)}
          placeholder="Why this change? (e.g. 'Calibrated ER benchmark against the Meridian carrier report, 2026 renewal')"
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => { setDraft(defaultClaimsBenchmarks()); }} className="text-gray-500">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset to shipped defaults
          </Button>
          <Button onClick={() => save.mutate()} disabled={blocked || save.isPending} className="bg-gray-900 hover:bg-gray-700">
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? 'Saving…' : 'Save benchmarks'}
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2"><History className="w-4 h-4" /> History</p>
          {history.map(h => (
            <div key={h.id} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
              {h.is_active ? <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5" /> : <span className="w-3.5" />}
              <div className="min-w-0">
                <p className="text-xs text-gray-600">
                  {h.updated_at ? new Date(h.updated_at).toLocaleString() : ''} · {h.updated_by || '—'}
                  {h.note ? ` — ${h.note}` : ''}
                </p>
                {(h.changed_summary || []).slice(0, 4).map((c, i) => <p key={i} className="text-[11px] text-gray-400">• {c}</p>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
