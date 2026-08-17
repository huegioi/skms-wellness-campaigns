import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { computeEnps } from '@/components/feedback/instrumentMeta';

// Portal privacy rule: never render a result built on fewer than 5 people.
const MIN_N = 5;

function avg(nums) {
  if (!nums.length) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function Tile({ label, value, sub }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-700">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Session Pulse rollup — the short post-session survey (FeedbackResponse).
 *
 * This is a single-point experience measure, NOT a before/after instrument, so
 * it is deliberately presented apart from the WHO-5 / PSS-4 / UWES-3 pre-post
 * cards: no deltas, no "pre/post" framing. Same n>=5 suppression as everywhere
 * else in the portal.
 */
export default function PulseFeedbackRollup({ pulseResponses = [] }) {
  const overall = useMemo(() => {
    const ratings = pulseResponses.map(r => r.overall_rating).filter(v => v != null);
    const confidences = pulseResponses.map(r => r.fit_confidence).filter(v => v != null);
    const npsScores = pulseResponses.map(r => r.nps_score).filter(v => v != null);
    const intents = pulseResponses.filter(r => r.behavior_intent).length;
    return {
      n: pulseResponses.length,
      avgRating: avg(ratings),
      avgConfidence: avg(confidences),
      nps: computeEnps(npsScores),
      intentRate: pulseResponses.length ? Math.round((intents / pulseResponses.length) * 100) : null,
    };
  }, [pulseResponses]);

  // Per-session breakdown, newest session first.
  const bySession = useMemo(() => {
    const groups = new Map();
    for (const r of pulseResponses) {
      const key = r.event_id || r.event_label || r.service_name || 'unlabeled';
      if (!groups.has(key)) {
        groups.set(key, { key, label: r.event_label || r.service_name || 'Session', rows: [], latest: r.submitted_at });
      }
      const g = groups.get(key);
      g.rows.push(r);
      if (r.submitted_at && (!g.latest || r.submitted_at > g.latest)) g.latest = r.submitted_at;
    }
    return [...groups.values()]
      .map(g => ({
        key: g.key,
        label: g.label,
        latest: g.latest,
        n: g.rows.length,
        avgRating: avg(g.rows.map(r => r.overall_rating).filter(v => v != null)),
        avgConfidence: avg(g.rows.map(r => r.fit_confidence).filter(v => v != null)),
      }))
      .sort((a, b) => new Date(b.latest || 0) - new Date(a.latest || 0));
  }, [pulseResponses]);

  if (overall.n === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-4 h-4 text-brand-plum" />
        <p className="text-sm font-semibold text-gray-700">Session Pulse — Post-Session Feedback</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Short survey sent after each session — self-reported experience, not a before/after comparison
      </p>

      {overall.n < MIN_N ? (
        <div className="border rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium text-gray-800">Session Pulse</p>
            <span className="text-xs text-gray-400">n={overall.n}</span>
          </div>
          <p className="text-xs text-gray-400 italic">Collecting data (n={overall.n})</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Responses" value={overall.n} sub="across all sessions" />
              <Tile
                label="Session Rating"
                value={overall.avgRating != null ? `${overall.avgRating.toFixed(1)}` : '—'}
                sub="out of 5"
              />
              <Tile
                label="Fit Confidence"
                value={overall.avgConfidence != null ? `${overall.avgConfidence.toFixed(1)}` : '—'}
                sub="out of 10"
              />
              <Tile
                label="Would Recommend"
                value={
                  overall.nps.enps != null && overall.nps.n >= MIN_N
                    ? `${overall.nps.enps >= 0 ? '+' : ''}${overall.nps.enps}`
                    : '—'
                }
                sub={overall.nps.n >= MIN_N ? `NPS · ${overall.nps.n} rated` : 'collecting data'}
              />
            </div>
            {overall.intentRate != null && (
              <p className="text-xs text-gray-500 mt-4 pt-3 border-t">
                <span className="font-semibold text-brand-green">{overall.intentRate}%</span> named a specific
                behavior they intend to change after the session.
              </p>
            )}
          </div>

          {bySession.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-0.5">By Session</p>
              <p className="text-xs text-gray-400 mb-3">
                Sessions with fewer than {MIN_N} responses are held back to protect participant privacy.
              </p>
              <div className="space-y-2">
                {bySession.map(s => (
                  <div key={s.key} className="flex items-center justify-between border rounded-lg px-3 py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.label}</p>
                      <p className="text-xs text-gray-400">
                        {s.n} response{s.n !== 1 ? 's' : ''}
                        {s.latest ? ` · ${new Date(s.latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                    {s.n < MIN_N ? (
                      <span className="text-xs text-gray-400 italic flex-shrink-0">Collecting data</span>
                    ) : (
                      <div className="flex gap-4 text-right flex-shrink-0">
                        <div>
                          <p className="text-[10px] text-gray-400">Rating</p>
                          <p className="text-sm font-semibold text-gray-700">
                            {s.avgRating != null ? s.avgRating.toFixed(1) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Confidence</p>
                          <p className="text-sm font-semibold text-brand-green">
                            {s.avgConfidence != null ? s.avgConfidence.toFixed(1) : '—'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
