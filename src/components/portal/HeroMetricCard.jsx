import React from 'react';
import { Badge } from '@/components/ui/badge';

// A single headline metric card with an evidence-tier badge.
export default function HeroMetricCard({ label, value, caption, evidenceTier, color = '#013f7c' }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        {evidenceTier && (
          <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500 whitespace-nowrap leading-tight px-1.5 py-0">
            {evidenceTier}
          </Badge>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {caption && <p className="text-xs text-gray-500 mt-1.5 leading-snug">{caption}</p>}
    </div>
  );
}