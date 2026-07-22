import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

export const DRIVERS = [
  { key: 'medical', label: 'Medical', color: '#0f766e' },
  { key: 'absenteeism', label: 'Absenteeism', color: '#4a2040' },
  { key: 'presenteeism', label: 'Presenteeism', color: '#b8860b' },
  { key: 'turnover', label: 'Turnover', color: '#7c3aed' },
  { key: 'workersComp', label: "Workers' Comp", color: '#6b7280' },
];

const RAMP = [0.45, 0.80, 1.00];

const fmtK = (v) => '$' + (v / 1000).toFixed(0) + 'k';

// Total label above each stacked bar
function TotalLabel({ x, y, width, payload }) {
  if (!payload?.total) return null;
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#78716c">
      {fmtK(payload.total)}
    </text>
  );
}

export default function SavingsChart({ drivers, globalMax }) {
  const data = RAMP.map((f, i) => {
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
              <LabelList dataKey="workersComp" content={<TotalLabel />} position="top" />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}