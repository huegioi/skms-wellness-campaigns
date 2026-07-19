import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { MFS_EVIDENCE_BLOCKS, getFirstSentence } from '@/lib/mfsScoreContent';
import { getZone, MFS_INSTRUMENTS } from '@/lib/mfsScore';

function getScoreBand(instrumentKey, score) {
  const zone = getZone(instrumentKey, score);
  if (zone === 'Low') return 'low';
  if (zone === 'High') return 'strong';
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
        {/* What-works callout — band line prepended, tinted bg + left accent border */}
        <div
          className="mt-2 px-3 py-2.5 rounded-r-md text-sm leading-relaxed"
          style={{
            backgroundColor: band === 'low' ? '#fffbeb' : band === 'strong' ? '#f0fdf4' : '#f8fafc',
            borderLeft: `3px solid ${band === 'low' ? '#f59e0b' : band === 'strong' ? '#15803d' : '#013f7c'}`,
          }}
        >
          {band && (
            <p className="font-semibold mb-1" style={{ color: band === 'low' ? '#b45309' : '#15803d' }}>
              {band === 'low' ? block.low : block.strong}
            </p>
          )}
          <p className="text-gray-600">{block.cta}</p>
        </div>

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
      </div>
    </div>
  );
}