import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

const DRIVERS = [
  { key: 'medical', label: 'Medical', color: '#0f766e' },
  { key: 'absenteeism', label: 'Absenteeism', color: '#4a2040' },
  { key: 'presenteeism', label: 'Presenteeism', color: '#b8860b' },
  { key: 'turnover', label: 'Turnover', color: '#7c3aed' },
  { key: 'workersComp', label: "Workers' Comp", color: '#6b7280' },
];

const fmtK = (v) => '$' + (v / 1000).toFixed(0) + 'k';

// Only render a value label when the bar is too short to read at the shared scale
function TinyBarLabel(props) {
  const { x, y, width, height, value } = props;
  if (value > 0 && height < 18) {
    return (
      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#78716c">
        {fmtK(value)}
      </text>
    );
  }
  return null;
}

export default function SavingsChart({ drivers, globalMax }) {
  const data = DRIVERS.map((d) => ({
    name: d.label,
    value: Math.round(drivers[d.key] || 0),
    color: d.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          domain={[0, globalMax]}
          tick={{ fontSize: 9, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtK}
          width={45}
        />
        <Tooltip
          formatter={(v) => '$' + v.toLocaleString()}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={200}
          animationEasing="ease"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
          <LabelList dataKey="value" content={<TinyBarLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}