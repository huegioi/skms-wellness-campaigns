import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { RESEARCH_MODEL } from '@/lib/roiModel';

/**
 * The four cost drivers the model actually pays out on, in plain language.
 *
 * Workers' comp was removed in the 2026-08-08 rebuild. runRoi() still returns
 * drivers.workersComp = 0 so the DOMAIN_WEIGHTS matrix in getJourneyDashboard
 * keeps its shape, but there is no defensible coefficient for it, so it is not
 * charted and not claimed.
 *
 * Ordered by evidential weight: presenteeism is the best-evidenced driver and
 * the largest, so it sits at the base of the stack.
 */
export const DRIVERS = [
  { key: 'presenteeism', label: 'Recovered working time', color: '#0f766e' },
  { key: 'absenteeism', label: 'Reduced absence', color: '#4a2040' },
  { key: 'turnover', label: 'Retention', color: '#b8860b' },
  { key: 'medical', label: 'Healthcare pathway', color: '#7c3aed' },
];

/** Effects ramp up as the programme matures; reach decays without re-prompting.
 *  Both live in RESEARCH_MODEL so this chart cannot drift from the model. */
const RAMP = (() => {
  const { ramp, reachRetention } = RESEARCH_MODEL;
  return [ramp.y1, ramp.y2 * reachRetention.y2, ramp.y3 * reachRetention.y3];
})();

const fmtK = (v) => '$' + (v / 1000).toFixed(0) + 'k';

// Total label above each stacked bar
function TotalLabel({ x, y, width, payload }) {
  if (!payload?.total || y == null) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#78716c">
      {fmtK(payload.total)}
    </text>
  );
}

export default function SavingsChart({ drivers, globalMax, ramp }) {
  const factors = ramp || RAMP;
  const data = factors.map((f, i) => {
    const row = { year: `Year ${i + 1}`, total: 0 };
    for (const d of DRIVERS) {
      const val = Math.round((drivers[d.key] || 0) * f);
      row[d.key] = val;
      row.total += val;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, globalMax]}
          tick={{ fontSize: 10, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtK}
          width={45}
        />
        <Tooltip
          formatter={(v) => '$' + v.toLocaleString()}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
        />
        {DRIVERS.map((d, i) => (
          <Bar
            key={d.key}
            dataKey={d.key}
            name={d.label}
            stackId="a"
            fill={d.color}
            radius={i === DRIVERS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            isAnimationActive
            animationDuration={200}
            animationEasing="ease"
          >
            {i === DRIVERS.length - 1 && (
              <LabelList dataKey={d.key} content={<TotalLabel />} position="top" />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
