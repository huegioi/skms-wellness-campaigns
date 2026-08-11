import React, { useState } from 'react';
import { ExternalLink, ChevronDown } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const block = MFS_EVIDENCE_BLOCKS[instrumentKey];
  if (!block) return null;

  const band = getScoreBand(instrumentKey, score);
  const inst = MFS_INSTRUMENTS.find(i => i.key === instrumentKey);
  const accentColor = inst?.color || '#441D37';

  const bodyFirst = getFirstSentence(block.body);
  const ctaFirst = getFirstSentence(block.cta);

  return (
    <div className="mt-2 pl-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-mf-ink-2 hover:text-mf-ink transition-colors mb-1"
      >
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        Learn more about this score
      </button>
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
      <p className="text-xs font-bold text-mf-ink mb-0.5">What this measures — and why it matters</p>
      <p className="text-xs text-mf-ink-2 leading-relaxed">{bodyFirst}</p>

      <p className="text-xs font-bold text-mf-ink mb-0.5 mt-3">What moves this score</p>
      <div
        className="px-3 py-2 rounded-r-md text-sm leading-relaxed"
        style={{
          backgroundColor: band === 'low' ? '#fffbeb' : band === 'strong' ? '#f0fdf4' : '#f8fafc',
          borderLeft: `3px solid ${band === 'low' ? '#f59e0b' : band === 'strong' ? '#15803d' : accentColor}`,
        }}
      >
        {band && (
          <p className="font-semibold mb-0.5 text-xs" style={{ color: band === 'low' ? '#B4531F' : '#15803d' }}>
            {band === 'low' ? block.low : block.strong}
          </p>
        )}
        <p className="text-xs text-mf-ink-2">{ctaFirst}</p>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {block.sources.slice(0, 3).map((src, i) => (
          <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-mf-plum hover:underline inline-flex items-center gap-0.5">
            {src.label}<ExternalLink className="w-2 h-2" />
          </a>
        ))}
      </div>
        </div>
      </div>
    </div>
  );
}