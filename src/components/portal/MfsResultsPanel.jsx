import React, { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { INSTRUMENT_META } from '@/components/feedback/instrumentMeta';

// Portal privacy rule: never render a result built on fewer than 5 people.
const MIN_N = 5;

/**
 * MFS rows store RAW item sums in instrument_total, which are NOT on the same
 * scale the instrument cards elsewhere use. Converting here rather than reusing
 * getScore() avoids showing HR a number on the wrong scale:
 *
 *   who5  — instrument_total is the 0–25 item sum; who5_total is the ×4
 *           standard 0–100 score. Use who5_total.
 *   uwes3 — instrument_total is the 0–18 item SUM; the published scale is the
 *           0–6 MEAN of three items. Divide by 3.
 *   pss4  — 0–16 item sum. Already the published scale.
 *   ucla3 — 0–9 item sum. Already the published scale.
 *
 * CBI and eNPS are not part of the MFS instrument set.
 */
function mfsScore(row) {
  const key = row.instrument;
  if (key === 'who5') {
    if (row.who5_total != null) return row.who5_total;
    return row.instrument_total != null ? row.instrument_total * 4 : null;
  }
  if (key === 'uwes3') {
    return row.instrument_total != null ? row.instrument_total / 3 : null;
  }
  return row.instrument_total ?? null;
}

const MFS_INSTRUMENTS = ['who5', 'pss4', 'uwes3', 'ucla3'];

export default function MfsResultsPanel({ mfsAssessments = [] }) {
  const rows = mfsAssessments;

  const stats = useMemo(() => {
    const byInstrument = {};
    for (const r of rows) {
      const key = r.instrument;
      if (!MFS_INSTRUMENTS.includes(key)) continue;
      const score = mfsScore(r);
      if (score == null) continue;
      (byInstrument[key] ||= []).push(score);
    }
    return MFS_INSTRUMENTS
      .filter(key => byInstrument[key]?.length)
      .map(key => {
        const scores = byInstrument[key];
        const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
        return { key, n: scores.length, avgScore };
      });
  }, [rows]);

  // Respondent count = the largest per-instrument n (each person answers every
  // instrument, so this is the team size that took the assessment).
  const respondents = useMemo(
    () => stats.reduce((m, s) => Math.max(m, s.n), 0),
    [stats]
  );

  const latest = useMemo(() => {
    const dates = rows.map(r => r.submitted_at).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [rows]);

  if (stats.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Gauge className="w-4 h-4 text-brand-plum" />
        <p className="text-sm font-semibold text-gray-700">Mental Fitness Score — Team Assessment</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Anonymous team snapshot — a single point in time, not a before/after comparison
        {latest ? ` · most recent response ${new Date(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
      </p>

      {respondents < MIN_N ? (
        <div className="border rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium text-gray-800">Mental Fitness Score</p>
            <span className="text-xs text-gray-400">n={respondents}</span>
          </div>
          <p className="text-xs text-gray-400 italic">Collecting data (n={respondents})</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Team averages</p>
              <p className="text-xs text-gray-400">{respondents} people completed the assessment</p>
            </div>
            <Badge variant="outline" className="text-xs border-gray-200 text-gray-500 whitespace-nowrap">
              Single-point snapshot
            </Badge>
          </div>
          <div className="space-y-2">
            {stats.map(({ key, n, avgScore }) => {
              const meta = INSTRUMENT_META[key];
              return (
                <div key={key} className="flex items-center justify-between border rounded-lg px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{meta?.label || key}</p>
                    <p className="text-xs text-gray-400">{meta?.scale}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-700">{avgScore.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400">n={n}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 italic mt-3 pt-3 border-t">
            Individual responses are never shown — only team averages. Scores here are a
            starting picture, not a program result.
          </p>
        </div>
      )}
    </div>
  );
}
