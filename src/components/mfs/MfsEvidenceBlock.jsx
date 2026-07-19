import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { MFS_EVIDENCE_BLOCKS, getFirstSentence } from '@/lib/mfsScoreContent';
import { TYPICAL_BANDS, MFS_INSTRUMENTS } from '@/lib/mfsScore';

function getScoreBand(instrumentKey, score) {
  if (score == null) return null;
  const range = TYPICAL_BANDS[instrumentKey]?.typicalRange;
  if (!range) return null;
  const [min, max] = range;
  if (score < min) return 'low';
  if (score > max) return 'strong';
  return null;
}

export default function MfsEvidenceBlock({ instrumentKey, score }) {
  const block = MFS_EVIDENCE_BLOCKS[instrumentKey];
  const [expanded, setExpanded] = useState(false);
  if (!block) return null;

  const band = getScoreBand(instrumentKey, score);
  const inst = MFS_INSTRUMENTS.find(i => i.key === instrumentKey);
  const accentColor = inst?.color || '#013f7c';

  const firstSentence = getFirstSentence(block.body);
  const restOfBody = block.body.slice(firstSentence.length).trim();

  return (
    <div className="mt-2 pl-0.5">
      {/* Body — first sentence always visible; rest hidden on mobile unless expanded */}
      <p className="text-xs text-gray-500 leading-relaxed">
        <span>{firstSentence}</span>
        {restOfBody && (
          <span className={expanded ? 'inline' : 'hidden sm:inline'}> {restOfBody}</span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="sm:hidden ml-1 text-[#013f7c] font-medium hover:underline"
        >
          {expanded ? 'show less' : 'learn more'}
        </button>
      </p>

      {/* Score-band line, sources, CTA — hidden on mobile unless expanded */}
      <div className={expanded ? 'block' : 'hidden sm:block'}>
        {band && (
          <div
            className="text-xs font-medium mt-2 px-2.5 py-1.5 rounded-md"
            style={{
              color: band === 'low' ? '#b45309' : '#15803d',
              backgroundColor: band === 'low' ? '#fffbeb' : '#f0fdf4',
            }}
          >
            {band === 'low' ? block.low : block.strong}
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {block.sources.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#013f7c] hover:underline inline-flex items-center gap-0.5"
            >
              {src.label}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>

        <p className="text-xs text-gray-400 italic mt-1.5">{block.cta}</p>
      </div>
    </div>
  );
}