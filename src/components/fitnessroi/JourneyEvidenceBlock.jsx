import React from 'react';
import { ExternalLink } from 'lucide-react';
import { MFS_EVIDENCE_BLOCKS, getFirstSentence } from '@/lib/mfsScoreContent';
import { getZone, MFS_INSTRUMENTS } from '@/lib/mfsScore';

function getScoreBand(instrumentKey, score) {
  const zone = getZone(instrumentKey, score);
  if (zone === 'Low') return 'low';
  if (zone === 'High') return 'strong';
  return null;
}

// Condensed version of MfsEvidenceBlock — one sentence per paragraph, one per callout.
export default function JourneyEvidenceBlock({ instrumentKey, score }) {
  const block = MFS_EVIDENCE_BLOCKS[instrumentKey];
  if (!block) return null;

  const band = getScoreBand(instrumentKey, score);
  const inst = MFS_INSTRUMENTS.find(i => i.key === instrumentKey);
  const accentColor = inst?.color || '#4a2040';

  const bodyFirst = getFirstSentence(block.body);
  const ctaFirst = getFirstSentence(block.cta);

  return (
    <div className="mt-2 pl-0.5">
      <p className="text-xs font-bold text-stone-700 mb-0.5">What this measures — and why it matters</p>
      <p className="text-xs text-stone-500 leading-relaxed">{bodyFirst}</p>

      <p className="text-xs font-bold text-stone-700 mb-0.5 mt-3">What moves this score</p>
      <div
        className="px-3 py-2 rounded-r-md text-sm leading-relaxed"
        style={{
          backgroundColor: band === 'low' ? '#fffbeb' : band === 'strong' ? '#f0fdf4' : '#f8fafc',
          borderLeft: `3px solid ${band === 'low' ? '#f59e0b' : band === 'strong' ? '#15803d' : accentColor}`,
        }}
      >
        {band && (
          <p className="font-semibold mb-0.5 text-xs" style={{ color: band === 'low' ? '#b45309' : '#15803d' }}>
            {band === 'low' ? block.low : block.strong}
          </p>
        )}
        <p className="text-xs text-stone-600">{ctaFirst}</p>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {block.sources.slice(0, 3).map((src, i) => (
          <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-[#0f766e] hover:underline inline-flex items-center gap-0.5">
            {src.label}<ExternalLink className="w-2 h-2" />
          </a>
        ))}
      </div>
    </div>
  );
}