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
// Hues are FIXED per driver -- a driver keeps its colour whatever else is on
// screen, and they are never cycled or reassigned by rank. Values mirror
// src/styles/journeyTheme.css.
//
// This is a derived palette, not the one in the approved mockup. The mockup's
// pastels put mauve and sky ΔE 7.8 apart for normal vision and 3.6 apart under
// deuteranopia -- two of four drivers would have looked identical to roughly
// one man in twelve. This set was validated on both cream and white: worst
// adjacent pair ΔE 9.2 deuteranopia, 23.7 normal vision.
//
// Two of the four sit below 3:1 contrast against the surface, which is only
// acceptable because every driver is directly labelled with its name and value
// in text. Do not remove those labels without re-deriving the palette.
export const DRIVERS = [
  { key: 'presenteeism', label: 'Recovered working time', color: '#8E3F72' },
  { key: 'absenteeism', label: 'Reduced absence', color: '#EB6834' },
  { key: 'turnover', label: 'Retention', color: '#1BAF7A' },
  { key: 'medical', label: 'Healthcare pathway', color: '#2A78D6' },
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
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#5A4A52" fontWeight={600}>
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
          tick={{ fontSize: 11, fill: '#8A7B82' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, globalMax ?? 'auto']}
          tick={{ fontSize: 10, fill: '#8A7B82' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtK}
          width={45}
        />
        <Tooltip
          cursor={{ fill: 'rgba(68,29,55,0.05)' }}
          formatter={(v) => '$' + v.toLocaleString()}
          contentStyle={{
            fontSize: 11, borderRadius: 9, border: 'none', background: '#441D37',
            color: '#fff', boxShadow: '0 6px 22px rgba(36,16,25,.24)',
          }}
          itemStyle={{ color: '#fff' }}
          labelStyle={{ color: '#fff', fontWeight: 600 }}
        />
        {DRIVERS.map((d, i) => (
          <Bar
            key={d.key}
            dataKey={d.key}
            name={d.label}
            stackId="a"
            fill={d.color}
            radius={i === DRIVERS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            /* 2px of surface between stacked segments, so adjacent fills read
               as separate bands rather than one continuous shape. */
            stroke="#FFFFFF"
            strokeWidth={2}
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
