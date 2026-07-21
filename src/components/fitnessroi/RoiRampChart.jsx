import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DRIVERS = [
  { key: 'medical', label: 'Medical', color: '#0f766e' },
  { key: 'absenteeism', label: 'Absenteeism', color: '#4a2040' },
  { key: 'presenteeism', label: 'Presenteeism', color: '#b8860b' },
  { key: 'turnover', label: 'Turnover', color: '#7c3aed' },
  { key: 'workersComp', label: "Workers' Comp", color: '#6b7280' },
];

export default function RoiRampChart({ drivers }) {
  const factors = [0.45, 0.80, 1.00];
  const data = factors.map((f, i) => {
    const row = { year: `Year ${i + 1}` };
    for (const d of DRIVERS) row[d.key] = Math.round((drivers[d.key] || 0) * f);
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'} />
        <Tooltip formatter={(v) => '$' + v.toLocaleString()}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {DRIVERS.map(d => (
          <Bar key={d.key} dataKey={d.key} name={d.label} stackId="a" fill={d.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}