import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

/**
 * Program participation over time — how many PEOPLE took part in programs each
 * month, and how many PROGRAMS ran. Replaces the old "feedback responses per
 * month" chart, which counted form records (one person's 5-part assessment
 * counted 5 times).
 *
 * `participation` comes from getRoiData: one entry per delivered program with
 * the distinct (pseudonymous) people who took part. Months are keyed by the
 * program's date.
 */

export function summarizeParticipation(participation = [], cutoffDate = null) {
  const programs = participation.filter(p => !cutoffDate || (p.date && new Date(p.date) >= cutoffDate));
  const perPerson = new Map();
  const byMonth = {};
  for (const p of programs) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { people: new Set(), programs: 0 };
    byMonth[key].programs += 1;
    for (const pid of p.people || []) {
      byMonth[key].people.add(pid);
      perPerson.set(pid, (perPerson.get(pid) || 0) + 1);
    }
  }
  const months = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [y, m] = key.split('-');
      return {
        label: new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' }),
        people: v.people.size,
        programs: v.programs,
      };
    });
  const counts = [...perPerson.values()];
  const totalPeople = counts.length;
  const totalAttendances = counts.reduce((s, n) => s + n, 0);
  return {
    months,
    totalPeople,
    totalPrograms: programs.length,
    avgPrograms: totalPeople ? totalAttendances / totalPeople : 0,
    dist: {
      one: counts.filter(n => n === 1).length,
      two: counts.filter(n => n === 2).length,
      threePlus: counts.filter(n => n >= 3).length,
    },
  };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-0.5">{label}</p>
      <p className="text-[#013f7c]">{row.people} {row.people === 1 ? 'person' : 'people'} took part</p>
      <p className="text-[#770142]">{row.programs} {row.programs === 1 ? 'program' : 'programs'} delivered</p>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="text-xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function ProgramParticipationChart({ participation = [], cutoffDate = null }) {
  const s = useMemo(() => summarizeParticipation(participation, cutoffDate), [participation, cutoffDate]);
  if (s.totalPrograms === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-700 mb-0.5">Program Participation</p>
      <p className="text-xs text-gray-400 mb-4">
        People who took part in your programs each month, and how many programs ran.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat value={s.totalPeople} label={s.totalPeople === 1 ? 'person took part' : 'people took part'} />
        <Stat value={s.totalPrograms} label={s.totalPrograms === 1 ? 'program delivered' : 'programs delivered'} />
        <Stat value={s.avgPrograms.toFixed(1)} label="programs per person (avg)" />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={s.months} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis yAxisId="people" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
          <YAxis yAxisId="programs" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f3ef' }} />
          <Bar yAxisId="people" dataKey="people" fill="#013f7c" radius={[4, 4, 0, 0]} maxBarSize={48} />
          <Line yAxisId="programs" type="monotone" dataKey="programs" stroke="#770142" strokeWidth={2} dot={{ r: 4, fill: '#770142' }} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#013f7c]" />People (left)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#770142]" />Programs (right)</span>
        <span className="sm:ml-auto">
          Programs per person: 1 → {s.dist.one} · 2 → {s.dist.two} · 3+ → {s.dist.threePlus}
        </span>
      </div>
    </div>
  );
}
