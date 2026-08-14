import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { INSTRUMENT_META, describeChange, bandForScore, BAND_TONE_CLASSES } from './instrumentMeta';

// One reusable result card per instrument.
// Shows: plain-language name, scale, interpretation, pre→post delta with
// direction-aware coloring, n / completion, and an evidence-tier badge.
// startLabel / endLabel let each section name its own before/after explicitly
// ("Program Start" → "1 Month After") instead of the generic Pre/Post, so a
// follow-up survey is never read as an end-of-program one. Defaults preserve
// the original wording for existing callers.
//
// Score numbers are colored by research band (Low / Typical / High — same idea
// as the Mental Fitness journey dashboard) and clicking a number (or the
// "What does this number mean?" toggle) expands a simple explainer: what the
// band means per the published norms, and what moves the needle.

const bandPill = (band) =>
  band ? (BAND_TONE_CLASSES[band.tone] || 'bg-gray-100 text-gray-700') : 'text-gray-700';

// Colored, clickable score number with its band label underneath.
function BandScore({ value, band, onClick }) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="What does this number mean?"
        className={`text-lg font-bold rounded-lg px-2 py-0.5 ${band ? 'cursor-pointer' : 'cursor-default'} ${bandPill(band)}`}
      >
        {value.toFixed(1)}
      </button>
      {band && <p className="text-[10px] mt-0.5 text-gray-500">{band.label}</p>}
    </>
  );
}

// The click-to-expand "what does this number mean" panel.
function BandExplainer({ show, band, score }) {
  if (!show || !band) return null;
  return (
    <div className="mt-2 rounded-lg bg-gray-50 border p-3 space-y-2">
      <p className="text-xs text-gray-700 leading-relaxed">
        <span className={`font-semibold rounded px-1.5 py-0.5 mr-1 whitespace-nowrap ${bandPill(band)}`}>
          {score.toFixed(1)} · {band.label}
        </span>
        {band.meaning}
      </p>
      <p className="text-xs text-gray-600 leading-relaxed">
        <span className="font-semibold text-gray-700">What moves the needle: </span>
        {band.moveTheNeedle}
      </p>
      <p className="text-[10px] text-gray-400">Ranges from {band.source}.</p>
    </div>
  );
}

function BandToggle({ show, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-[#264d44] font-medium mt-3 hover:underline"
    >
      {show ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      What does this number mean?
    </button>
  );
}

export default function InstrumentResultCard({
  instrumentKey,
  stats,
  evidenceTier,
  startLabel = 'Pre',
  endLabel = 'Post',
}) {
  const [showBands, setShowBands] = useState(false);
  const meta = INSTRUMENT_META[instrumentKey];
  if (!meta || !stats) return null;

  const toggle = () => setShowBands(v => !v);
  const startBand = bandForScore(instrumentKey, stats.avgStart);

  // Baseline-only mode: starting numbers exist but no follow-up yet. Show the
  // Before value immediately and leave After/Change as pending — an HR reader
  // gets their starting picture without waiting for the end-of-program survey.
  if (stats.baselineOnly) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
            <p className="text-xs text-gray-400">{meta.scale}</p>
          </div>
          <Badge variant="outline" className="text-xs border-gray-200 text-gray-500 whitespace-nowrap">
            Baseline — awaiting follow-up
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">{meta.interpretation}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">{startLabel}</p>
            <BandScore value={stats.avgStart} band={startBand} onClick={toggle} />
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">{endLabel}</p>
            <p className="text-lg font-bold text-gray-300">—</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Change</p>
            <p className="text-lg font-bold text-gray-300">—</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">n</p>
            <p className="text-lg font-bold text-gray-700">{stats.n}</p>
          </div>
        </div>
        {startBand && <BandToggle show={showBands} onClick={toggle} />}
        <BandExplainer show={showBands} band={startBand} score={stats.avgStart} />
        <p className="text-xs text-gray-600 leading-relaxed mt-3 pt-3 border-t">
          <span className="font-semibold text-gray-700">What this means: </span>
          This is the team's starting picture — the average before programming. Change will be
          measured against this number once follow-up responses come in.
        </p>
      </div>
    );
  }

  const endBand = bandForScore(instrumentKey, stats.avgEnd);
  const deltaColor = stats.isGood ? '#264d44' : '#ef4444';
  const sign = stats.avgDelta >= 0 ? '+' : '';
  // Plain-language read of the delta, phrased with this section's own time-point
  // labels so "1 month after" never reads as "end of program".
  const narrative = describeChange(instrumentKey, stats, { startLabel, endLabel });

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
          <p className="text-xs text-gray-400">{meta.scale}</p>
        </div>
        <Badge variant="outline" className="text-xs border-gray-200 text-gray-500 whitespace-nowrap">
          {evidenceTier}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{meta.interpretation}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">{startLabel}</p>
          <BandScore value={stats.avgStart} band={startBand} onClick={toggle} />
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">{endLabel}</p>
          <BandScore value={stats.avgEnd} band={endBand} onClick={toggle} />
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">Change</p>
          <p className="text-lg font-bold" style={{ color: deltaColor }}>
            {sign}{stats.avgDelta.toFixed(1)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">n / Completion</p>
          <p className="text-lg font-bold text-gray-700">
            {stats.n} <span className="text-sm text-gray-400">/ {stats.completion}%</span>
          </p>
        </div>
      </div>
      {(startBand || endBand) && <BandToggle show={showBands} onClick={toggle} />}
      <BandExplainer
        show={showBands}
        band={endBand || startBand}
        score={endBand ? stats.avgEnd : stats.avgStart}
      />
      {narrative && (
        <p className="text-xs text-gray-600 leading-relaxed mt-3 pt-3 border-t">
          <span className="font-semibold text-gray-700">What this means: </span>
          {narrative}
        </p>
      )}
    </div>
  );
}
