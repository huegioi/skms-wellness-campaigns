import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, RotateCcw, Save, Info, History, Check } from 'lucide-react';
import {
  currentRateCard, defaultRateCard, applyRateCardOverrides, resetRateCard,
  validateRateCardInput, verifyRateCardIntegrity, verifyRateCard,
  computeQuote, CAMPAIGN_STAGES,
} from '@/lib/rateCard';
import { invalidateRateCard } from '@/lib/useRateCard';

// Plain-English labels. Anything not listed still renders, using its key.
const LABELS = {
  workshopFirstSession: ['First workshop session', 'Includes the recording and materials'],
  workshopExtraSession: ['Each repeat session', 'Same topic run again for a bigger company'],
  materialsComponent: ['Recording + materials', 'The part of the first session that only ships once'],
  attendanceRate: ['Expected attendance', 'Share of employees who show up (0.25 = 25%)'],
  maxAttendeesPerSession: ['Max attendees per session', 'The engagement cap'],
  challengeEngagementRate: ['Challenge sign-up rate', 'Share of headcount given slots (0.20 = 20%)'],
  challengeMinSlots: ['Minimum challenge slots', 'Never sell a challenge smaller than this'],
  leqSeries: ['Leadership EQ series', 'The three-workshop series, flat'],
  leqCoachingRatePerHour: ['Group coaching, per hour', 'Per coaching group'],
  leqCoachingHours: ['Coaching hours per block', ''],
  leqMaxLeadersPerGroup: ['Max leaders per group', ''],
  leqLcpPerLeader: ['LCP per leader', 'Assessment plus their individual session'],
  leqLeaderRate: ['Leaders as share of staff', '0.005 = 0.5% of headcount'],
  leqSingleWorkshop: ['One leadership workshop', 'Sold outside the series'],
  leqCoachingSession: ['Coaching session', 'Leadership EQ Coaching Program, per session'],
  wellnessBox: ['Wellness box (blended)', 'Used when quoting a tier'],
  newClientWelcome: ['First-time client discount', 'Comes off the total once'],
  inPersonTravelAddOn: ['In-person travel', 'Per trip. Never added automatically'],
};

const GROUPS = [
  { title: 'Workshops', keys: ['workshopFirstSession', 'workshopExtraSession', 'materialsComponent', 'attendanceRate', 'maxAttendeesPerSession'] },
  { title: '14-day challenges', keys: ['challengeEngagementRate', 'challengeMinSlots'] },
  { title: 'Leadership EQ', keys: ['leqSeries', 'leqCoachingRatePerHour', 'leqCoachingHours', 'leqMaxLeadersPerGroup', 'leqLcpPerLeader', 'leqLeaderRate', 'leqSingleWorkshop', 'leqCoachingSession'] },
  { title: 'Wellness boxes & extras', keys: ['wellnessBox', 'newClientWelcome', 'inPersonTravelAddOn'] },
];

const money = (n) => '$' + Math.round(n).toLocaleString();
const SIZES = [200, 500, 1000, 2000, 4000];

export default function RateCard() {
  const qc = useQueryClient();
  const defaults = useMemo(() => defaultRateCard(), []);

  const { data: activeRecord, isLoading } = useQuery({
    queryKey: ['rateCardSetting'],
    queryFn: async () => {
      const rows = await base44.entities.RateCardSetting.filter({ is_active: true }, '-updated_at', 1);
      return rows?.[0] || null;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['rateCardHistory'],
    queryFn: () => base44.entities.RateCardSetting.list('-updated_at', 15),
  });

  const [draft, setDraft] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isLoading) return;
    resetRateCard();
    applyRateCardOverrides(activeRecord?.overrides);
    setDraft(currentRateCard());
  }, [activeRecord, isLoading]);

  const setRate = (key, raw) =>
    setDraft(d => ({ ...d, rates: { ...d.rates, [key]: raw === '' ? '' : Number(raw) } }));
  const setBox = (key, raw) =>
    setDraft(d => ({ ...d, boxPrices: { ...d.boxPrices, [key]: raw === '' ? '' : Number(raw) } }));
  const setClass = (key, raw) =>
    setDraft(d => ({ ...d, classPrices: { ...d.classPrices, [key]: raw === '' ? '' : Number(raw) } }));
  const setBand = (i, field, raw) =>
    setDraft(d => ({
      ...d,
      challengeTiers: d.challengeTiers.map((t, idx) =>
        idx === i ? { ...t, [field]: raw === '' ? '' : Number(raw) } : t),
    }));

  // Validation + preview run on every keystroke, against the draft only.
  const { inputProblems, integrityProblems, proformaDrift, preview } = useMemo(() => {
    if (!draft) return { inputProblems: [], integrityProblems: [], proformaDrift: [], preview: null };
    const inputProblems = validateRateCardInput(draft);
    if (inputProblems.length) {
      return { inputProblems, integrityProblems: [], proformaDrift: [], preview: null };
    }
    const integrityProblems = verifyRateCardIntegrity(draft);

    // Price the draft without disturbing what the rest of the app is using.
    const snapshot = currentRateCard();
    resetRateCard();
    applyRateCardOverrides(draft);
    const proformaDrift = verifyRateCard();
    const preview = SIZES.map(hc => ({
      hc, totals: CAMPAIGN_STAGES.map(s => computeQuote({ headcount: hc, stage: s.stage }).total),
    }));
    resetRateCard();
    applyRateCardOverrides(snapshot);

    return { inputProblems, integrityProblems, proformaDrift, preview };
  }, [draft]);

  const changedKeys = useMemo(() => {
    if (!draft) return [];
    const out = [];
    for (const [k, v] of Object.entries(draft.rates)) {
      if (Number(v) !== Number(defaults.rates[k])) out.push(`${LABELS[k]?.[0] || k}: ${defaults.rates[k]} → ${v}`);
    }
    for (const [k, v] of Object.entries(draft.boxPrices)) {
      if (Number(v) !== Number(defaults.boxPrices[k])) out.push(`Box ${k}: ${defaults.boxPrices[k]} → ${v}`);
    }
    for (const [k, v] of Object.entries(draft.classPrices)) {
      if (Number(v) !== Number(defaults.classPrices[k])) out.push(`Class ${k}: ${defaults.classPrices[k]} → ${v}`);
    }
    draft.challengeTiers.forEach((t, i) => {
      const d = defaults.challengeTiers[i];
      if (!d || Number(t.price) !== Number(d.price)) out.push(`Challenge band ${i + 1}: ${d ? d.price : '—'} → ${t.price}`);
    });
    return out;
  }, [draft, defaults]);

  const blocked = inputProblems.length > 0 || integrityProblems.length > 0;

  const save = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me().catch(() => null);
      // Supersede rather than overwrite, so history survives.
      for (const row of history.filter(h => h.is_active)) {
        await base44.entities.RateCardSetting.update(row.id, { is_active: false });
      }
      return base44.entities.RateCardSetting.create({
        is_active: true,
        overrides: draft,
        note: note.trim() || undefined,
        changed_summary: changedKeys,
        updated_by: user?.email,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      invalidateRateCard();
      resetRateCard();
      applyRateCardOverrides(draft);
      setNote('');
      qc.invalidateQueries({ queryKey: ['rateCardSetting'] });
      qc.invalidateQueries({ queryKey: ['rateCardHistory'] });
      toast.success('Rate card saved. Every quote in the app uses these prices now.');
    },
    onError: (e) => toast.error(e?.message || 'Could not save the rate card.'),
  });

  if (isLoading || !draft) {
    return <div className="p-8 text-gray-400">Loading the rate card…</div>;
  }

  const field = (key, value, onChange, label, hint) => (
    <div key={key} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <Input
        type="number"
        step="any"
        className="w-32 text-right"
        value={value}
        onChange={e => onChange(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Rate card</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
          Every price the app quotes lives here — the Quick Builder, the Mental Fitness Journey, proposals,
          invoices and the challenge estimator all read these numbers. Change one and it changes everywhere.
        </p>
      </div>

      {inputProblems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800">
            <AlertTriangle className="w-4 h-4" /> Fix these before saving
          </p>
          <ul className="mt-2 text-sm text-red-700 list-disc ml-5 space-y-0.5">
            {inputProblems.map(p => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}
      {integrityProblems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800">
            <AlertTriangle className="w-4 h-4" /> These prices would break your quoting
          </p>
          <ul className="mt-2 text-sm text-red-700 list-disc ml-5 space-y-0.5">
            {integrityProblems.map(p => <li key={p}>{p}</li>)}
          </ul>
          <p className="text-xs text-red-600 mt-2">
            Saving is blocked because these would let a larger company be quoted less than a smaller one,
            or make a higher tier cost no more than a lower one.
          </p>
        </div>
      )}

      {!blocked && proformaDrift.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Info className="w-4 h-4" /> These prices no longer match the Proforma
          </p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            That is fine if you meant it — just update the Proforma too, so the workbook and the app agree.
            {' '}First difference: {proformaDrift[0]}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {GROUPS.map(g => (
            <div key={g.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-bold text-gray-800 mb-2">{g.title}</h2>
              {g.keys.filter(k => k in draft.rates).map(k =>
                field(k, draft.rates[k], setRate, LABELS[k]?.[0] || k, LABELS[k]?.[1]))}
            </div>
          ))}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-2">Wellness boxes</h2>
            {Object.keys(draft.boxPrices).map(k => field(k, draft.boxPrices[k], setBox, k, ''))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-2">Classes</h2>
            {Object.keys(draft.classPrices).map(k => field(k, draft.classPrices[k], setClass, k, 'Per series'))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-1">Challenge volume bands</h2>
            <p className="text-xs text-gray-400 mb-3">Price per person, by number of slots.</p>
            {draft.challengeTiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600 w-28">
                  {t.min}{t.max === Infinity || t.max === null ? '+' : `–${t.max}`} slots
                </span>
                <span className="text-xs text-gray-400 flex-1">per person</span>
                <Input type="number" step="any" className="w-24 text-right"
                  value={t.price} onChange={e => setBand(i, 'price', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-4">
            <h2 className="font-bold text-gray-800 mb-1">What a client would be quoted</h2>
            <p className="text-xs text-gray-400 mb-3">Updates as you type, before anything is saved.</p>
            {preview ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="text-left font-medium pb-2">Employees</th>
                      {CAMPAIGN_STAGES.map(s => (
                        <th key={s.stage} className="text-right font-medium pb-2 px-1">{s.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(row => (
                      <tr key={row.hc} className="border-t border-gray-100">
                        <td className="py-1.5 font-semibold text-gray-700">{row.hc.toLocaleString()}</td>
                        {row.totals.map((t, i) => (
                          <td key={i} className="py-1.5 px-1 text-right text-gray-600">{money(t)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Fix the errors above to see the preview.</p>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                {changedKeys.length === 0 ? 'No changes from the shipped defaults' : `${changedKeys.length} change${changedKeys.length > 1 ? 's' : ''}`}
              </p>
              {changedKeys.length > 0 && (
                <ul className="text-xs text-gray-600 space-y-0.5 max-h-32 overflow-y-auto">
                  {changedKeys.map(c => <li key={c}>· {c}</li>)}
                </ul>
              )}
            </div>

            <Textarea
              className="mt-4"
              rows={2}
              placeholder="Why are you changing this? (optional, saved with the history)"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <div className="flex gap-2 mt-3">
              <Button
                disabled={blocked || save.isPending}
                onClick={() => save.mutate()}
                className="bg-brand-navy hover:bg-brand-navy-dark gap-2 flex-1"
              >
                <Save className="w-4 h-4" />
                {save.isPending ? 'Saving…' : 'Save rate card'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDraft(defaultRateCard())}
                className="gap-2"
                title="Restore the prices that ship in the code"
              >
                <RotateCcw className="w-4 h-4" /> Defaults
              </Button>
            </div>
            {blocked && (
              <p className="text-xs text-red-600 mt-2">Saving is blocked until the problems above are fixed.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" /> History
            </h2>
            {history.length === 0 && <p className="text-sm text-gray-400">No changes yet — the app is using the shipped defaults.</p>}
            <ul className="space-y-3">
              {history.map(h => (
                <li key={h.id} className="text-xs border-l-2 border-gray-200 pl-3">
                  <p className="font-medium text-gray-700">
                    {h.is_active && <Check className="w-3 h-3 inline text-green-600 mr-1" />}
                    {h.updated_at ? new Date(h.updated_at).toLocaleString() : 'unknown date'}
                    {h.updated_by ? ` · ${h.updated_by}` : ''}
                  </p>
                  {h.note && <p className="text-gray-500 mt-0.5 italic">{h.note}</p>}
                  {(h.changed_summary || []).slice(0, 4).map(c => (
                    <p key={c} className="text-gray-400">· {c}</p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
