import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// Trend chart showing engagement (response count) over time.
export default function EngagementTrendChart({ pulseResponses = [], cohortAssessments = [] }) {
  const data = useMemo(() => {
    const byMonth = {};
    for (const r of pulseResponses) {
      if (!r.submitted_at) continue;
      const d = new Date(r.submitted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    for (const r of cohortAssessments) {
      if (!r.submitted_at) continue;
      const d = new Date(r.submitted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          label: date.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
          count,
        };
      });
  }, [pulseResponses, cohortAssessments]);

  if (data.length < 2) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-700 mb-0.5">Engagement Over Time</p>
      <p className="text-xs text-gray-400 mb-4">Feedback responses per month across all programs.</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#013f7c" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#013f7c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke="#013f7c" strokeWidth={2} fill="url(#engagementGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}