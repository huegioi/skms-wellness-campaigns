import React, { useLayoutEffect, useMemo, useState } from 'react';
import { INSTRUMENT_BANDS, bandForScore, getInstrumentKey, getScore } from '@/components/feedback/instrumentMeta';

/**
 * "Wellbeing, program by program" — the first chart on the portal's results tab.
 *
 * One column per wellbeing check-in (a program's WHO-5 survey), oldest on the
 * left. Each dot is one person's anonymous WHO-5 score (0–100); people with the
 * same score sit side by side, so the shape of each column shows how the whole
 * team is doing, not just the average. The coral line joins the team average
 * at each check-in and its end label is the change from the first check-in to
 * the latest. The shading is the published WHO-5 ranges, so even a single
 * baseline column reads at a glance.
 *
 * Privacy: a check-in with fewer than MIN_N people is left out, like every
 * other portal result. Rows arrive pseudonymised from getRoiData; nothing here
 * names anyone.
 */

const MIN_N = 5;
const MAX_COLS = 8;
const PLUM = '#441D37';
const CORAL = '#E8866A';
const PHASE_ORDER = { cohort_start: 0, challenge_day0: 1, session_check: 2, challenge_day14: 3, cohort_end: 4, cohort_1mo: 5 };
const PHASE_LABEL = { cohort_start: 'Start', challenge_day0: 'Day 0', session_check: 'Check-in', challenge_day14: 'Day 14', cohort_end: 'End', cohort_1mo: '1 month after' };
const BAND_FILL = { poor: ['#fbe9e7', '#fdf3f1'], mid: ['#fcf1dc', '#fdf8ec'], good: ['#e3f3e8', '#eef8f1'] };
const BAND_TEXT = { poor: '#b0473e', mid: '#9a6612', good: '#2c7148' };

// "Beyond Burnout Workshop" → "Beyond Burnout" (the type is in the tooltip).
const shortTitle = (t) => String(t || 'Check-in').replace(/\s+(Workshop|Challenge|Program|Session|Intensive)$/i, '').trim();

// Callback-ref width tracker (the chart can unmount and remount its box when
// a date filter empties it, so a plain ref would keep watching a dead node).
function useWidth() {
  const [node, setNode] = useState(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!node) return undefined;
    setW(Math.round(node.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, w];
}

// WHO-5 rows → one column per (program, survey phase), each person counted once.
function buildColumns(rows, participation, services) {
  const progById = new Map((participation || []).filter(p => p.event_id).map(p => [p.event_id, p]));
  const svcName = new Map((services || []).map(s => [s.id, s.name]));
  const groups = new Map();
  rows.forEach((r, idx) => {
    const prog = r.event_id ? progById.get(r.event_id) : null;
    const programKey = r.event_id || `svc:${r.service_id || 'unknown'}:${String(r.submitted_at).slice(0, 7)}`;
    const key = `${programKey}|${r.survey_type || ''}`;
    if (!groups.has(key)) {
      const full = (prog && prog.title) || svcName.get(r.service_id) || 'Check-in';
      groups.set(key, {
        key, programKey, phase: r.survey_type || '', fullTitle: full, title: shortTitle(full),
        programDate: prog?.date || null, first: r.submitted_at, people: new Map(),
      });
    }
    const g = groups.get(key);
    if (r.submitted_at < g.first) g.first = r.submitted_at;
    const pid = String(r.participant_email || r.id || `row-${idx}`).toLowerCase().trim();
    const prev = g.people.get(pid);
    if (!prev || r.submitted_at > prev.at) g.people.set(pid, { at: r.submitted_at, score: getScore(r) });
  });
  const all = [...groups.values()].map(g => {
    const values = [...g.people.values()].map(p => p.score).sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / (values.length || 1);
    return { ...g, values, n: values.length, mean, date: g.programDate || g.first };
  }).sort((a, b) => (String(a.date).localeCompare(String(b.date))) || ((PHASE_ORDER[a.phase] ?? 9) - (PHASE_ORDER[b.phase] ?? 9)));
  const shown = all.filter(c => c.n >= MIN_N);
  const perProgram = {};
  for (const c of shown) perProgram[c.programKey] = (perProgram[c.programKey] || 0) + 1;
  for (const c of shown) c.sub = perProgram[c.programKey] > 1 ? (PHASE_LABEL[c.phase] || '') : '';
  return { cols: shown.slice(-MAX_COLS), hidden: all.length - shown.length, trimmed: Math.max(0, shown.length - MAX_COLS) };
}

const monthOf = (iso, withYear) => new Date(iso).toLocaleDateString('en', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });

export default function WellbeingDotPlot({ cohortAssessments = [], participation = [], services = [] }) {
  const [wrapRef, W] = useWidth();
  const [hover, setHover] = useState(null);

  const rows = useMemo(
    () => cohortAssessments.filter(r =>
      getInstrumentKey(r) === 'who5' && r.survey_type !== 'mfs' && getScore(r) != null && r.submitted_at),
    [cohortAssessments]
  );
  const { cols, hidden, trimmed } = useMemo(() => buildColumns(rows, participation, services), [rows, participation, services]);

  if (rows.length === 0) return null;
  if (cols.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-0.5">Wellbeing, program by program</p>
        <p className="text-xs text-gray-400">Each wellbeing check-in appears here once at least {MIN_N} people have answered it.</p>
      </div>
    );
  }

  const single = cols.length === 1;
  const years = new Set(cols.map(c => new Date(c.date).getFullYear()));
  const withYear = years.size > 1;

  // ── geometry ──
  const wide = W >= 560;
  const padL = 34, padR = wide ? 104 : 40, padT = 12;
  const plotH = wide ? 248 : 208;
  const plotW = Math.max(120, W - padL - padR);
  const slots = single ? 2 : Math.max(1, cols.length);
  const colW = plotW / slots;
  const y = v => padT + (1 - v / 100) * plotH;
  const cx = i => padL + (i + 0.5) * colW;
  const maxTies = Math.max(1, ...cols.map(c => {
    const t = {}; c.values.forEach(v => { const k = Math.round(v); t[k] = (t[k] || 0) + 1; });
    return Math.max(...Object.values(t));
  }));
  const stepPx = 4 / 100 * plotH;                       // WHO-5 moves in steps of 4
  const dx = Math.min(10.5, (colW * 0.82) / maxTies);
  const r = Math.max(1.6, Math.min(4.6, dx * 0.44, stepPx * 0.46));

  // beeswarm: ties side by side, centred on the column
  const dots = [];
  const halfAt = cols.map(() => ({}));               // per column: rounded score → half-width of its row
  cols.forEach((c, i) => {
    const groups = {};
    c.values.forEach(v => { const k = Math.round(v); (groups[k] = groups[k] || []).push(v); });
    Object.entries(groups).forEach(([k, arr]) => {
      arr.forEach((v, j) => {
        const off = j === 0 ? 0 : (j % 2 ? 1 : -1) * Math.ceil(j / 2);
        dots.push({ x: cx(i) + off * dx, y: y(v), i });
      });
      halfAt[i][k] = Math.ceil((arr.length - 1) / 2) * dx + r;
    });
  });
  const halfNear = (i, v) => Math.max(r, ...Object.entries(halfAt[i]).filter(([k]) => Math.abs(+k - v) <= 4).map(([, h]) => h));

  // research ranges as background bands (WHO-5 moves in 4s, so each boundary
  // sits between the last score inside a band and the first one past it)
  const def = INSTRUMENT_BANDS.who5;
  let lo = 0;
  const bands = def.bands.map((b, i) => {
    const hi = Number.isFinite(b.max) ? Math.floor(b.max / 4) * 4 + 2 : 100;
    const band = { ...b, lo, hi: Math.min(100, hi), shade: i > 0 && def.bands[i - 1].tone === b.tone ? 1 : 0 };
    lo = band.hi;
    return band;
  });

  const first = cols[0], last = cols[cols.length - 1];
  const delta = cols.length > 1 ? last.mean - first.mean : null;
  const deltaText = delta == null ? '' : `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta))}`;
  const firstBand = first ? bandForScore('who5', first.mean) : null;
  const lastBand = last ? bandForScore('who5', last.mean) : null;
  const linePts = cols.map((c, i) => [cx(i), y(c.mean)]);
  let endLabel = null;
  if (cols.length > 1) {
    const i = cols.length - 1;
    let lx = cx(i) + halfNear(i, last.mean) + 9;
    let ly = y(last.mean) + 5;
    if (lx + 34 > padL + plotW + padR - 4) { lx = cx(i) - 14; ly = y(last.mean) - halfNear(i, last.mean + 6) - 6; }
    endLabel = { x: lx, y: ly };
  }
  const H = padT + plotH + 64;
  const tip = hover != null && cols[hover] ? cols[hover] : null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-0.5">Wellbeing, program by program</p>
          <p className="text-xs text-gray-400">
            WHO-5 wellbeing score (0–100) at each check-in. {single ? 'This first column is your starting point.' : 'Shading shows the research ranges.'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0 sm:pt-0.5">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLUM, opacity: 0.8 }} />1 dot = 1 employee</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 h-[3px] rounded-full" style={{ backgroundColor: CORAL }} />Team average</span>
        </div>
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height: H }}>
        {W > 0 && first && (
          <>
            <svg width={W} height={H} className="absolute left-0 top-0 overflow-visible" role="img"
              aria-label={single
                ? `WHO-5 wellbeing baseline: ${first.n} people, team average ${Math.round(first.mean)} (${firstBand?.label || ''}).`
                : `WHO-5 wellbeing at ${cols.length} check-ins: team average ${Math.round(first.mean)} to ${Math.round(last.mean)} (${deltaText}).`}>
              {/* research ranges */}
              {bands.map(b => (
                <rect key={b.label} x={padL} width={plotW} y={y(b.hi)} height={y(b.lo) - y(b.hi)} fill={BAND_FILL[b.tone]?.[b.shade] || '#f6f6f6'} />
              ))}
              {bands.slice(0, -1).map(b => (
                <line key={b.label} x1={padL} x2={padL + plotW} y1={y(b.hi)} y2={y(b.hi)} stroke="#fff" strokeWidth={1.5} />
              ))}
              {wide && bands.map(b => (
                <text key={b.label} x={padL + plotW + 10} y={(y(b.lo) + y(b.hi)) / 2 + 4} fontSize={11} fontWeight={600} fill={BAND_TEXT[b.tone]}>{b.label}</text>
              ))}
              {/* y axis */}
              {[0, 20, 40, 60, 80, 100].map(v => (
                <text key={v} x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={10.5} fill="#a39399">{v}</text>
              ))}
              <line x1={padL} x2={padL + plotW} y1={y(0)} y2={y(0)} stroke="#ddd3d8" strokeWidth={1.2} />

              {/* the next check-in, while there is only a baseline */}
              {single && (
                <rect x={padL + colW + 14} y={padT + 8} width={colW - 28} height={plotH - 16} rx={12}
                  fill="rgba(255,255,255,0.6)" stroke="#cdbfc7" strokeWidth={1.5} strokeDasharray="6 5" />
              )}

              {/* hover column */}
              {tip && <rect x={padL + hover * colW + 4} y={padT} width={colW - 8} height={plotH} rx={10} fill="rgba(68,29,55,0.05)" />}

              {/* one dot per person */}
              <g>
                {dots.map((d, k) => <circle key={k} cx={d.x} cy={d.y} r={r} fill={PLUM} fillOpacity={0.78} />)}
              </g>

              {/* team average */}
              {cols.length > 1 ? (
                <>
                  <polyline points={linePts.map(p => p.join(',')).join(' ')} fill="none" stroke={CORAL} strokeWidth={wide ? 4 : 3} strokeLinecap="round" strokeLinejoin="round" />
                  {linePts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={wide ? 4.5 : 3.5} fill="#fff" stroke={CORAL} strokeWidth={2.5} />)}
                  {endLabel && (
                    <text x={endLabel.x} y={endLabel.y} fontSize={wide ? 17 : 14} fontWeight={700} fill={CORAL}>{deltaText}</text>
                  )}
                </>
              ) : (
                (() => {
                  const hw = halfNear(0, first.mean) + 12;
                  return (
                    <>
                      <line x1={cx(0) - hw} x2={cx(0) + hw} y1={y(first.mean)} y2={y(first.mean)} stroke={CORAL} strokeWidth={wide ? 4 : 3} strokeLinecap="round" />
                      <text x={cx(0) + hw + 8} y={y(first.mean) + 5} fontSize={wide ? 15 : 13} fontWeight={700} fill={CORAL}>avg {Math.round(first.mean)}</text>
                    </>
                  );
                })()
              )}

              {/* hover targets */}
              {cols.map((c, i) => (
                <rect key={c.key} x={padL + i * colW} y={padT} width={colW} height={plotH + 52} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              ))}
            </svg>

            {/* x labels */}
            {cols.map((c, i) => (
              <div key={c.key} className="absolute text-center px-1 pointer-events-none" style={{ left: padL + i * colW, width: colW, top: padT + plotH + 8 }}>
                <p className="text-xs font-semibold text-gray-800 leading-tight">{monthOf(c.date, withYear)}{c.sub ? ` · ${c.sub}` : ''}</p>
                <p className="text-[11px] text-gray-500 leading-tight truncate mt-0.5" title={c.fullTitle}>{c.title}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">avg {Math.round(c.mean)} · {c.n} people</p>
              </div>
            ))}
            {single && (
              <div className="absolute flex flex-col items-center justify-center text-center px-6 pointer-events-none"
                style={{ left: padL + colW + 14, width: colW - 28, top: padT + 8, height: plotH - 16 }}>
                <p className="text-sm font-semibold text-gray-500">Next check-in</p>
                <p className="text-xs text-gray-400 mt-1 leading-snug">Each program's check-in adds a column here, so you can watch the whole team move.</p>
              </div>
            )}

            {/* tooltip */}
            {tip && (
              <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs pointer-events-none"
                style={{ left: Math.min(Math.max(4, padL + hover * colW + colW / 2 - 100), W - 204), top: 0, width: 200 }}>
                <p className="font-semibold text-gray-700">{tip.fullTitle}</p>
                <p className="text-gray-400">{new Date(tip.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}{tip.sub ? ` · ${tip.sub}` : ''}</p>
                <p className="text-gray-600 mt-1">{tip.n} people · average {tip.mean.toFixed(1)}</p>
                <p className="text-gray-500">{bandForScore('who5', tip.mean)?.label} · range {Math.round(tip.values[0])}–{Math.round(tip.values[tip.values.length - 1])}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 leading-relaxed">
        {single ? (
          <p>
            Starting team average <span className="font-semibold text-gray-800">{Math.round(first.mean)}</span>
            {firstBand && <> · <span className="font-semibold" style={{ color: BAND_TEXT[firstBand.tone] }}>{firstBand.label}</span>. {firstBand.meaning}</>}
          </p>
        ) : first && (
          <p>
            Team average <span className="font-semibold text-gray-800">{Math.round(first.mean)} → {Math.round(last.mean)}</span>
            {' '}(<span className="font-semibold" style={{ color: delta >= 0 ? '#23794a' : '#b4372d' }}>{deltaText}</span>) from {monthOf(first.date, withYear)} to {monthOf(last.date, withYear)}
            {firstBand && lastBand && firstBand.label !== lastBand.label ? <>, from <span style={{ color: BAND_TEXT[firstBand.tone] }}>{firstBand.label}</span> to <span style={{ color: BAND_TEXT[lastBand.tone] }}>{lastBand.label}</span></> : ''}.
            {' '}<span className="text-gray-400">Each column counts everyone who answered that check-in; the matched before/after results are below.</span>
          </p>
        )}
        {(hidden > 0 || trimmed > 0) && (
          <p className="text-gray-400 mt-1">
            {hidden > 0 ? 'Check-ins with fewer than 5 people are left out to protect privacy. ' : ''}
            {trimmed > 0 ? `Showing the ${MAX_COLS} most recent check-ins.` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
