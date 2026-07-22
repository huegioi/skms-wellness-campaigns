import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

const DRIVERS = [
  { key: 'medical', label: 'Medical' },
  { key: 'absenteeism', label: 'Absenteeism' },
  { key: 'presenteeism', label: 'Presenteeism' },
  { key: 'turnover', label: 'Turnover' },
  { key: 'workersComp', label: 'W. Comp' },
];

const fmtK = (v) => '$' + (v / 1000).toFixed(0) + 'k';

// Value label above every bar
function BarLabel(props) {
  const { x, y, width, value } = props;
  if (value > 0) {
    return (
      <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="#78716c">
        {fmtK(value)}
      </text>
    );
  }
  return null;
}

export default function SavingsChart({ drivers, globalMax, barColor }) {
  const data = DRIVERS.map((d) => ({
    name: d.label,
    value: Math.round(drivers[d.key] || 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#78716c' }}
          axisLine={false}
          tickLine={false}
          interval={0}
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
          {data.map((_, i) => (
            <Cell key={i} fill={barColor} />
          ))}
          <LabelList dataKey="value" content={<BarLabel />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}