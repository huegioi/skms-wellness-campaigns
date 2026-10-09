import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import InstrumentResultCard from './InstrumentResultCard';
import {
  INSTRUMENT_META, INSTRUMENT_BANDS, NORM_RANGES, BAND_TONE_CLASSES,
  normalizeScore, bandForScore, changeVerdict,
} from './instrumentMeta';

/**
 * One survey result as a picture instead of a number.
 *
 * The bar is the instrument's whole range, split into its published bands
 * (Low / Typical / High …) and always oriented so that FURTHER RIGHT IS
 * BETTER — stress, loneliness and burnout are flipped, so an HR reader never
 * has to remember which way is good. A filled dot marks where the team is now;
 * with a follow-up, a hollow dot marks where it started and a line joins them.
 *
 * The raw numbers (averages, change, n, band explainer, plain-language read)
 * are one click away: the row opens to the full InstrumentResultCard.
 */

const SEG_FILL = { poor: ['#f8d7d3', '#fbe8e5'], mid: ['#f7e3b8', '#fbefd6'], good: ['#cce9d5', '#e2f3e7'] };
const SEG_TEXT = { poor: '#a1372f', mid: '#86580a', good: '#276a41' };
const VERDICT_COLOR = { good: '#23794a', poor: '#b4372d', flat: '#6b7280' };
const PLUM = '#441D37';

// Band segments laid out left→right on the "right is better" scale (0–100).
function segmentsFor(key) {
  const def = INSTRUMENT_BANDS[key];
  const range = NORM_RANGES[key];
  if (!def || !range) return [];
  const segs = def.bands.map((b, i) => {
    const lo = i === 0 ? range.min : Math.max(range.min, def.bands[i - 1].max);
    const hi = Number.isFinite(b.max) ? Math.min(b.max, range.max) : range.max;
    const a = normalizeScore(lo, key);
    const z = normalizeScore(hi, key);
    return { label: b.label, tone: b.tone, left: Math.min(a, z), width: Math.abs(z - a) };
  }).filter(s => s.width > 0.5).sort((x, y) => x.left - y.left);
  // Neighbours that share a tone (e.g. WHO-5 "Below typical" | "Typical") get
  // alternating shades so the boundary between them still reads.
  segs.forEach((s, i) => { s.shade = i > 0 && segs[i - 1].tone === s.tone && segs[i - 1].shade === 0 ? 1 : 0; });
  return segs;
}

const pos = (v, key) => Math.max(1.5, Math.min(98.5, normalizeScore(v, key) ?? 0));

export function BandBar({ instrumentKey, stats, showLabels = true }) {
  const segs = segmentsFor(instrumentKey);
  const hasEnd = !stats.baselineOnly && stats.avgEnd != null;
  const p0 = pos(stats.avgStart, instrumentKey);
  const p1 = hasEnd ? pos(stats.avgEnd, instrumentKey) : null;
  const verdict = hasEnd ? changeVerdict(instrumentKey, stats) : null;
  const lineColor = VERDICT_COLOR[verdict?.tone || 'flat'];
  return (
    <div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full overflow-hidden">
          {segs.map(s => (
            <div
              key={s.label}
              className="absolute top-0 bottom-0"
              style={{ left: `${s.left}%`, width: `${s.width}%`, backgroundColor: SEG_FILL[s.tone]?.[s.shade] || '#eee', boxShadow: 'inset -1px 0 0 #fff' }}
            />
          ))}
        </div>
        {hasEnd && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full"
            style={{ left: `${Math.min(p0, p1)}%`, width: `${Math.abs(p1 - p0)}%`, backgroundColor: lineColor }}
          />
        )}
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={hasEnd
            ? { left: `${p0}%`, width: 13, height: 13, backgroundColor: '#fff', border: `2.5px solid ${PLUM}`, opacity: 0.55 }
            : { left: `${p0}%`, width: 15, height: 15, backgroundColor: PLUM, border: '2.5px solid #fff', boxShadow: '0 1px 3px rgba(68,29,55,.45)' }}
        />
        {hasEnd && (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${p1}%`, width: 15, height: 15, backgroundColor: PLUM, border: '2.5px solid #fff', boxShadow: '0 1px 3px rgba(68,29,55,.45)' }}
          />
        )}
      </div>
      {showLabels && (
        <div className="relative h-4 mt-0.5 hidden sm:block">
          {segs.map(s => (
            <span
              key={s.label}
              className="absolute top-0 text-[10px] font-medium text-center truncate px-0.5"
              style={{ left: `${s.left}%`, width: `${s.width}%`, color: SEG_TEXT[s.tone] }}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Legend for a group of rows.
export function ScoreBandLegend({ followUp }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
      {followUp && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block rounded-full" style={{ width: 11, height: 11, border: `2px solid ${PLUM}`, opacity: 0.55 }} />Start
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block rounded-full" style={{ width: 11, height: 11, backgroundColor: PLUM }} />{followUp ? 'Latest' : 'Starting point'}
      </span>
      <span className="text-gray-400">Further right is better</span>
    </div>
  );
}

export default function ScoreBandRow({ instrumentKey, stats, evidenceTier, startLabel = 'Before', endLabel = 'After', defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = INSTRUMENT_META[instrumentKey];
  if (!meta || !stats) return null;

  const hasEnd = !stats.baselineOnly && stats.avgEnd != null;
  const startBand = bandForScore(instrumentKey, stats.avgStart);
  const nowBand = hasEnd ? bandForScore(instrumentKey, stats.avgEnd) : startBand;
  const verdict = hasEnd ? changeVerdict(instrumentKey, stats) : null;
  let verdictText = 'Starting point';
  if (verdict) {
    verdictText = verdict.label;
    if (verdict.tone !== 'flat' && startBand && nowBand && startBand.label !== nowBand.label) verdictText += ` · was ${startBand.label}`;
  }
  const verdictColor = VERDICT_COLOR[verdict?.tone || 'flat'];

  const status = (
    <div>
      {nowBand && (
        <span className={`inline-block text-xs font-semibold rounded-md px-2 py-0.5 whitespace-nowrap ${BAND_TONE_CLASSES[nowBand.tone] || 'bg-gray-100 text-gray-700'}`}>
          {nowBand.label}
        </span>
      )}
      <p className="text-[11px] mt-1 leading-tight" style={{ color: verdictColor }}>{verdictText}</p>
    </div>
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${meta.short}: ${nowBand?.label || ''}. ${verdictText}. Show the raw score.`}
        className="w-full text-left px-5 py-3.5 hover:bg-[#faf8f4] transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
          <div className="sm:w-40 shrink-0 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{meta.short}</p>
              <p className="text-[11px] text-gray-400">{meta.code} · {stats.n} {stats.n === 1 ? 'person' : 'people'}</p>
            </div>
            <div className="sm:hidden text-right">{status}</div>
          </div>
          <div className="flex-1 min-w-0 sm:pt-3"><BandBar instrumentKey={instrumentKey} stats={stats} /></div>
          <div className="hidden sm:block w-40 shrink-0 text-right">{status}</div>
          <span className="flex items-center justify-end gap-1 text-[11px] font-medium text-[#264d44] shrink-0 sm:w-[84px]">
            Raw score
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 mx-5 mb-3 rounded-lg bg-[#faf8f4] border border-[#efeae1]">
          <InstrumentResultCard
            embedded
            instrumentKey={instrumentKey}
            stats={stats}
            evidenceTier={evidenceTier}
            startLabel={startLabel}
            endLabel={endLabel}
          />
        </div>
      )}
    </div>
  );
}
