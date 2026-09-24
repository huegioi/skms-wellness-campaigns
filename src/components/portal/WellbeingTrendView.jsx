import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea,
} from 'recharts';
import {
  INSTRUMENT_META, INSTRUMENT_BANDS, NORM_RANGES, BAND_TONE_CLASSES,
  getInstrumentKey, getScore, normalizeScore, matchPairs, calcBaseline, calcStats, bandForScore, describeChange,
} from '@/components/feedback/instrumentMeta';

/**
 * Wellbeing side of the Engagement/Wellbeing toggle.
 *
 * - "All measures": every survey instrument on one 0–100 scale where UP is
 *   always better (normalizeScore inverts stress/loneliness/burnout).
 * - Single instrument: raw score on its own scale with research bands shaded.
 * - Program markers: vertical lines at the months programs ran.
 * - Program impact: per program, matched before→after for the selected
 *   measure (or baseline-only while follow-up is pending).
 *
 * Privacy: any month/program with fewer than MIN_N people is withheld.
 */

const MIN_N = 5;
const WELLBEING_KEYS = ['who5', 'uwes3', 'pss4', 'ucla3', 'cbi'];
const SHORT = { who5: 'Wellbeing', uwes3: 'Engagement', pss4: 'Stress', ucla3: 'Loneliness', cbi: 'Burnout' };
const COLORS = { who5: '#013f7c', uwes3: '#264d44', pss4: '#770142', ucla3: '#b7791f', cbi: '#6b7280' };
const TONE_FILL = { good: '#dcfce7', mid: '#fef3c7', poor: '#fee2e2' };
const PAIRS = [
  { start: 'cohort_start', end: ['cohort_end', 'session_check'], startLabel: 'Before', endLabel: 'After' },
  { start: 'challenge_day0', end: 'challenge_day14', startLabel: 'Day 0', endLabel: 'Day 14' },
];

const monthKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
};
const fmt = (key, v) => (v == null ? '—' : key === 'uwes3' ? v.toFixed(1) : v.toFixed(v >= 20 ? 0 : 1));

function programImpact(rows, key) {
  const dir = INSTRUMENT_META[key]?.directionOfGood || 'higher';
  for (const p of PAIRS) {
    const { pairs, distinctStarts } = matchPairs(rows, p.start, p.end);
    if (pairs.length >= MIN_N) {
      return { mode: 'pre_post', stats: calcStats(pairs, distinctStarts, dir), startLabel: p.startLabel, endLabel: p.endLabel };
    }
  }
  for (const p of PAIRS) {
    const base = calcBaseline(rows, p.start);
    if (base && base.n >= MIN_N) return { mode: 'baseline', stats: base };
  }
  return null;
}

export default function WellbeingTrendView({ cohortAssessments = [], participation = [], services = [], cutoffDate = null }) {
  const rows = useMemo(
    () => cohortAssessments.filter(r =>
      WELLBEING_KEYS.includes(getInstrumentKey(r)) && getScore(r) != null && r.submitted_at &&
      (!cutoffDate || new Date(r.submitted_at) >= cutoffDate)),
    [cohortAssessments, cutoffDate]
  );
  const available = useMemo(() => WELLBEING_KEYS.filter(k => rows.some(r => getInstrumentKey(r) === k)), [rows]);
  const [selected, setSelected] = useState('all');
  const sel = selected === 'all' || available.includes(selected) ? selected : 'all';

  const programs = useMemo(
    () => participation.filter(p => !cutoffDate || (p.date && new Date(p.date) >= cutoffDate)),
    [participation, cutoffDate]
  );

  // Monthly averages per instrument (raw + normalized), withheld under MIN_N.
  const data = useMemo(() => {
    const acc = {};
    for (const r of rows) {
      const mk = monthKey(r.submitted_at);
      const k = getInstrumentKey(r);
      acc[mk] = acc[mk] || {};
      acc[mk][k] = acc[mk][k] || [];
      acc[mk][k].push(getScore(r));
    }
    for (const p of programs) if (p.date) acc[monthKey(p.date)] = acc[monthKey(p.date)] || {};
    return Object.keys(acc).sort().map(mk => {
      const point = { key: mk, label: monthLabel(mk) };
      for (const k of WELLBEING_KEYS) {
        const vals = acc[mk][k] || [];
        if (vals.length >= MIN_N) {
          const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
          point[`raw_${k}`] = avg;
          point[`norm_${k}`] = normalizeScore(avg, k);
          point[`n_${k}`] = vals.length;
        }
      }
      return point;
    });
  }, [rows, programs]);

  // Program markers grouped by month.
  const markers = useMemo(() => {
    const byMonth = {};
    for (const p of programs) {
      if (!p.date) continue;
      const lbl = monthLabel(monthKey(p.date));
      (byMonth[lbl] = byMonth[lbl] || []).push(p.title);
    }
    return Object.entries(byMonth).map(([label, titles]) => ({
      label,
      text: titles.length === 1 ? (titles[0].length > 26 ? titles[0].slice(0, 25) + '…' : titles[0]) : `${titles.length} programs`,
    }));
  }, [programs]);

  // Per-program impact for the selected measure (or every measure in "all").
  const impact = useMemo(() => {
    const titleById = new Map(programs.filter(p => p.event_id).map(p => [p.event_id, p.title]));
    const svcName = new Map(services.map(s => [s.id, s.name]));
    const groups = {};
    for (const r of rows) {
      const gk = r.event_id || `svc:${r.service_id || 'unknown'}`;
      if (!groups[gk]) {
        groups[gk] = {
          title: (r.event_id && titleById.get(r.event_id)) || svcName.get(r.service_id) || 'Program',
          rows: [],
        };
      }
      groups[gk].rows.push(r);
    }
    const keys = sel === 'all' ? available : [sel];
    return Object.values(groups).map(g => ({
      title: g.title,
      results: keys
        .map(k => ({ key: k, res: programImpact(g.rows.filter(r => getInstrumentKey(r) === k), k) }))
        .filter(x => x.res),
    })).filter(g => g.results.length > 0);
  }, [rows, programs, services, sel, available]);

  if (available.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        No wellbeing survey scores yet. They'll appear here once participants complete a program assessment.
      </div>
    );
  }

  const bands = sel !== 'all' ? INSTRUMENT_BANDS[sel]?.bands || [] : [];
  const range = sel !== 'all' ? NORM_RANGES[sel] : { min: 0, max: 100 };
  const hasPoints = data.some(d => (sel === 'all' ? available.some(k => d[`norm_${k}`] != null) : d[`raw_${sel}`] != null));

  const TooltipBox = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0].payload;
    const keys = sel === 'all' ? available : [sel];
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs space-y-0.5">
        <p className="font-semibold text-gray-700">{label}</p>
        {keys.filter(k => pt[`raw_${k}`] != null).map(k => (
          <p key={k} style={{ color: COLORS[k] }}>
            {SHORT[k]}: {fmt(k, pt[`raw_${k}`])}
            <span className="text-gray-400"> · {bandForScore(k, pt[`raw_${k}`])?.label || ''} · n={pt[`n_${k}`]}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Measure chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['all', ...available].map(k => (
          <button
            key={k}
            onClick={() => setSelected(k)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${sel === k ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {k === 'all' ? 'All measures' : SHORT[k]}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        {sel === 'all'
          ? 'Every survey on one 0–100 scale where higher always means better (stress, loneliness and burnout are flipped). Hover for the actual scores.'
          : `${INSTRUMENT_META[sel].label} · ${INSTRUMENT_META[sel].scale}. Shading shows the research ranges (green = healthy, amber = typical, red = concern).`}
      </p>

      {hasPoints ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 18, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            {bands.map((b, i) => {
              const lo = i === 0 ? range.min : bands[i - 1].max;
              const hi = Number.isFinite(b.max) ? Math.min(b.max, range.max) : range.max;
              return <ReferenceArea key={b.label} y1={lo} y2={hi} fill={TONE_FILL[b.tone]} fillOpacity={0.5} ifOverflow="hidden" />;
            })}
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis domain={[range.min, range.max]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip content={<TooltipBox />} />
            {markers.map(m => (
              <ReferenceLine
                key={m.label}
                x={m.label}
                stroke="#9ca3af"
                strokeDasharray="4 3"
                label={{ value: m.text, position: 'top', fontSize: 10, fill: '#6b7280' }}
              />
            ))}
            {(sel === 'all' ? available : [sel]).map(k => (
              <Line
                key={k}
                type="monotone"
                dataKey={sel === 'all' ? `norm_${k}` : `raw_${k}`}
                name={SHORT[k]}
                stroke={COLORS[k]}
                strokeWidth={2}
                dot={{ r: 4, fill: COLORS[k] }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-8 text-center text-sm text-gray-400">Not enough responses yet to chart (at least {MIN_N} per month).</p>
      )}

      {sel === 'all' && hasPoints && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
          {available.map(k => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-0.5" style={{ backgroundColor: COLORS[k] }} />{SHORT[k]}
            </span>
          ))}
          {markers.length > 0 && (
            <span className="inline-flex items-center gap-1.5"><span className="w-0 h-3 border-l border-dashed border-gray-400" />Program ran</span>
          )}
        </div>
      )}

      {/* Program impact */}
      {impact.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Program impact</p>
          <div className="space-y-3">
            {impact.map(g => (
              <div key={g.title} className="rounded-lg border border-gray-100 p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">{g.title}</p>
                <div className="space-y-1.5">
                  {g.results.map(({ key: k, res }) => {
                    if (res.mode === 'baseline') {
                      const band = bandForScore(k, res.stats.avgStart);
                      return (
                        <div key={k} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="w-24 text-gray-500">{SHORT[k]}</span>
                          <span className="font-semibold text-gray-700">{fmt(k, res.stats.avgStart)}</span>
                          {band && <span className={`px-1.5 py-0.5 rounded ${BAND_TONE_CLASSES[band.tone]}`}>{band.label}</span>}
                          <span className="text-gray-400">baseline · n={res.stats.n} · follow-up pending</span>
                        </div>
                      );
                    }
                    const st = res.stats;
                    const sentence = sel !== 'all' ? describeChange(k, st, { startLabel: res.startLabel, endLabel: res.endLabel }) : null;
                    return (
                      <div key={k} className="text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-24 text-gray-500">{SHORT[k]}</span>
                          <span className="text-gray-600">{fmt(k, st.avgStart)} → <span className="font-semibold text-gray-800">{fmt(k, st.avgEnd)}</span></span>
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${st.isGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                            {st.avgDelta >= 0 ? '+' : ''}{fmt(k, st.avgDelta)}
                          </span>
                          <span className="text-gray-400">{res.startLabel} → {res.endLabel} · n={st.n} matched</span>
                        </div>
                        {sentence && <p className="text-gray-500 mt-1 leading-snug">{sentence}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Before/after compares the same people (matched), with no control group — read changes as what this group reported, not proof of cause.
          </p>
        </div>
      )}
    </div>
  );
}
