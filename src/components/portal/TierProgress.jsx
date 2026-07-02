import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

const fmtRate = (r) => (r * 100 % 1 === 0 ? (r * 100).toFixed(0) : (r * 100).toFixed(1));

export default function TierProgress({ tiers = [], commissionSummary = {} }) {
  if (!tiers.length) return null;

  const sorted = [...tiers].sort((a, b) => a.min_revenue - b.min_revenue);
  const ytd = commissionSummary.ytd_revenue || 0;

  const currentIdx = (() => {
    const ct = commissionSummary.current_tier;
    if (ct) {
      const i = sorted.findIndex(t => t.min_revenue === ct.min_revenue);
      if (i >= 0) return i;
    }
    // Fallback: highest tier whose min_revenue <= ytd
    let idx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (ytd >= sorted[i].min_revenue) idx = i;
      else break;
    }
    return idx;
  })();

  const current = sorted[currentIdx];
  const next = sorted[currentIdx + 1] || null;

  if (!current) return null;

  // At the top tier
  if (!next) {
    return (
      <Card className="border-[#e6e1d8] bg-[#f9f8f5]">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#013f7c]" />
            <p className="text-sm font-semibold text-[#013f7c]">
              You're at the top tier — {fmtRate(current.rate)}% on every placement
            </p>
          </div>
          <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: '#013f7c' }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">Based on first-year revenue placed this calendar year.</p>
        </CardContent>
      </Card>
    );
  }

  const rangeStart = current.min_revenue;
  const rangeEnd = next.min_revenue;
  const rangeSize = rangeEnd - rangeStart;
  const clamped = Math.min(Math.max(ytd, rangeStart), rangeEnd);
  const pct = rangeSize > 0 ? ((clamped - rangeStart) / rangeSize) * 100 : 100;
  const remaining = Math.max(rangeEnd - ytd, 0);

  return (
    <Card className="border-[#e6e1d8] bg-[#f9f8f5]">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <p className="text-sm font-semibold text-[#013f7c]">
            You're <span className="font-bold">${remaining.toLocaleString()}</span> away from the {fmtRate(next.rate)}% tier
          </p>
          <span className="text-xs text-gray-500">
            {current.label || 'Current tier'} → {next.label || 'Next tier'}
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: '#013f7c' }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
          <span>${rangeStart.toLocaleString()}</span>
          <span>${rangeEnd.toLocaleString()}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Based on first-year revenue placed this calendar year.</p>
      </CardContent>
    </Card>
  );
}