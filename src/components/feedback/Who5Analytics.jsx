import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, ArrowUpDown, Users } from 'lucide-react';

// ── Shared matching helpers ────────────────────────────────────────────────────

function matchPairs(rows, startType, endType) {
  const starts = {};
  const ends = {};
  for (const r of rows) {
    const email = (r.participant_email || '').toLowerCase().trim();
    if (!email) continue;
    if (r.survey_type === startType) starts[email] = r;
    if (r.survey_type === endType)   ends[email]   = r;
  }
  const pairs = [];
  for (const email of Object.keys(starts)) {
    if (ends[email]) {
      pairs.push({ email, start: starts[email].who5_total, end: ends[email].who5_total });
    }
  }
  return { pairs, distinctStarts: Object.keys(starts).length };
}

function calcStats(pairs, distinctStarts) {
  if (!pairs.length) return null;
  const n = pairs.length;
  const avgStart = pairs.reduce((s, p) => s + p.start, 0) / n;
  const avgEnd   = pairs.reduce((s, p) => s + p.end,   0) / n;
  const avgDelta = avgEnd - avgStart;
  const completion = distinctStarts > 0 ? Math.round((n / distinctStarts) * 100) : 0;
  return { n, avgStart, avgEnd, avgDelta, completion };
}

// ── Small presentational pieces ───────────────────────────────────────────────

function Delta({ value }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const color = value >= 0 ? '#264d44' : '#ef4444';
  const sign  = value >= 0 ? '+' : '';
  return <span style={{ color }} className="font-semibold">{sign}{value.toFixed(1)}</span>;
}

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.field === field;
  return (
    <button
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-[#013f7c] transition-colors ${active ? 'text-[#013f7c]' : 'text-gray-400'}`}
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${active ? 'text-[#013f7c]' : 'text-gray-300'}`} />
    </button>
  );
}

function AggBanner({ pairs }) {
  const stats = calcStats(pairs, pairs.length); // completion N/A at top level
  if (!pairs.length) return null;
  const deltaColor = stats.avgDelta >= 0 ? '#264d44' : '#ef4444';
  const sign = stats.avgDelta >= 0 ? '+' : '';
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-6 items-center mb-4">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Total Matched Pairs</p>
        <p className="text-2xl font-bold text-gray-800">{pairs.length}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Overall Avg Change</p>
        <p className="text-2xl font-bold" style={{ color: deltaColor }}>{sign}{stats.avgDelta.toFixed(1)}</p>
      </div>
      <p className="text-xs text-gray-400 self-end pb-1">pre/post (uncontrolled)</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
      <Activity className="w-12 h-12 mx-auto mb-3 text-gray-200" />
      <p className="text-gray-500 font-medium">{message}</p>
      <p className="text-sm text-gray-400 mt-1">Results appear once start and end responses come in.</p>
    </div>
  );
}

// ── By-Cohort table ───────────────────────────────────────────────────────────

function CohortTable({ rows, clientMap, sort, onSort }) {
  // Group by client_id + proposal_id
  const groups = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = `${r.client_id}||${r.proposal_id || ''}`;
      if (!map[key]) map[key] = { client_id: r.client_id, proposal_id: r.proposal_id, rows: [] };
      map[key].rows.push(r);
    }
    return Object.values(map).map(g => {
      const { pairs, distinctStarts } = matchPairs(g.rows, 'cohort_start', 'cohort_end');
      const stats = calcStats(pairs, distinctStarts);
      const company = clientMap[g.client_id] || g.client_id || '—';
      return { key: `${g.client_id}||${g.proposal_id}`, company, stats };
    }).filter(g => g.stats);
  }, [rows, clientMap]);

  const sorted = useMemo(() => {
    const s = [...groups];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return s.sort((a, b) => {
      if (sort.field === 'change')      return dir * (a.stats.avgDelta - b.stats.avgDelta);
      if (sort.field === 'completion')  return dir * (a.stats.completion - b.stats.completion);
      if (sort.field === 'n')           return dir * (a.stats.n - b.stats.n);
      return 0;
    });
  }, [groups, sort]);

  if (!sorted.length) return <EmptyState message="No cohort paired data matches the current filters." />;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Company</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Year Arc</th>
            <th className="px-4 py-3 text-center"><SortHeader label="Avg Change" field="change" sort={sort} onSort={onSort} /></th>
            <th className="px-4 py-3 text-center"><SortHeader label="n" field="n" sort={sort} onSort={onSort} /></th>
            <th className="px-4 py-3 text-center"><SortHeader label="Completion" field="completion" sort={sort} onSort={onSort} /></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map(g => (
            <tr key={g.key} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">{g.company}</td>
              <td className="px-4 py-3 text-center text-gray-600">
                {g.stats.avgStart.toFixed(1)} → {g.stats.avgEnd.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-center"><Delta value={g.stats.avgDelta} /></td>
              <td className="px-4 py-3 text-center text-gray-600">{g.stats.n}</td>
              <td className="px-4 py-3 text-center text-gray-600">{g.stats.completion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── By-Challenge table ────────────────────────────────────────────────────────

function ChallengeTable({ rows, clientMap, serviceMap, sort, onSort }) {
  const groups = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = `${r.client_id}||${r.service_id || ''}`;
      if (!map[key]) map[key] = { client_id: r.client_id, service_id: r.service_id, rows: [] };
      map[key].rows.push(r);
    }
    return Object.values(map).map(g => {
      const { pairs, distinctStarts } = matchPairs(g.rows, 'challenge_day0', 'challenge_day14');
      const stats = calcStats(pairs, distinctStarts);
      const company  = clientMap[g.client_id]   || g.client_id  || '—';
      const challenge = serviceMap[g.service_id] || g.service_id || '—';
      return { key: `${g.client_id}||${g.service_id}`, company, challenge, stats };
    }).filter(g => g.stats);
  }, [rows, clientMap, serviceMap]);

  const sorted = useMemo(() => {
    const s = [...groups];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return s.sort((a, b) => {
      if (sort.field === 'change')      return dir * (a.stats.avgDelta - b.stats.avgDelta);
      if (sort.field === 'completion')  return dir * (a.stats.completion - b.stats.completion);
      if (sort.field === 'n')           return dir * (a.stats.n - b.stats.n);
      return 0;
    });
  }, [groups, sort]);

  if (!sorted.length) return <EmptyState message="No challenge paired data matches the current filters." />;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Company</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Challenge</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Day 0 → Day 14</th>
            <th className="px-4 py-3 text-center"><SortHeader label="Avg Change" field="change" sort={sort} onSort={onSort} /></th>
            <th className="px-4 py-3 text-center"><SortHeader label="n" field="n" sort={sort} onSort={onSort} /></th>
            <th className="px-4 py-3 text-center"><SortHeader label="Completion" field="completion" sort={sort} onSort={onSort} /></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map(g => (
            <tr key={g.key} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">{g.company}</td>
              <td className="px-4 py-3 text-gray-700">{g.challenge}</td>
              <td className="px-4 py-3 text-center text-gray-600">
                {g.stats.avgStart.toFixed(1)} → {g.stats.avgEnd.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-center"><Delta value={g.stats.avgDelta} /></td>
              <td className="px-4 py-3 text-center text-gray-600">{g.stats.n}</td>
              <td className="px-4 py-3 text-center text-gray-600">{g.stats.completion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Who5Analytics({ filters }) {
  const [cohortSort,    setCohortSort]    = useState({ field: 'change', dir: 'desc' });
  const [challengeSort, setChallengeSort] = useState({ field: 'change', dir: 'desc' });

  // Load CohortAssessment (admin can read all)
  const { data: allAssessments = [], isLoading: loadingA } = useQuery({
    queryKey: ['cohort-assessments-all'],
    queryFn: () => base44.entities.CohortAssessment.list('-submitted_at', 2000),
  });

  // Load clients for company name lookup
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-compact'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
  });

  // Load services for challenge name lookup
  const { data: services = [] } = useQuery({
    queryKey: ['services-list-compact'],
    queryFn: () => base44.entities.Service.list('-created_date', 200),
  });

  const clientMap  = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.company || c.name])), [clients]);
  const serviceMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s.name])), [services]);

  // ── Apply existing filters ────────────────────────────────────────────────
  const filteredAssessments = useMemo(() => {
    return allAssessments.filter(r => {
      // company → client_id (resolve company name to client ids)
      if (filters.company !== 'all') {
        const matchingClientIds = clients.filter(c => (c.company || c.name) === filters.company).map(c => c.id);
        if (!matchingClientIds.includes(r.client_id)) return false;
      }
      // cohortYear → cohort_year field
      if (filters.cohortYear !== 'all') {
        const year = r.cohort_year || (r.submitted_at ? new Date(r.submitted_at).getFullYear() : null);
        if (String(year) !== filters.cohortYear) return false;
      }
      // date range → submitted_at
      if (filters.startDate && r.submitted_at && r.submitted_at.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate   && r.submitted_at && r.submitted_at.slice(0, 10) > filters.endDate)   return false;
      return true;
    });
  }, [allAssessments, filters, clients]);

  // Cohort rows (year-arc)
  const cohortRows = useMemo(() =>
    filteredAssessments.filter(r => r.survey_type === 'cohort_start' || r.survey_type === 'cohort_end'),
    [filteredAssessments]
  );

  // Challenge rows — also apply category filter (challenge type only has one category)
  const challengeRows = useMemo(() => {
    let rows = filteredAssessments.filter(r => r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14');
    // category filter: if not "all" and not "challenge", hide challenge rows
    if (filters.category !== 'all' && filters.category !== 'challenge') rows = [];
    return rows;
  }, [filteredAssessments, filters.category]);

  // Aggregate banner: all matched pairs across both sections
  const allPairs = useMemo(() => {
    const cohortGrouped = {};
    for (const r of cohortRows) {
      const key = `${r.client_id}||${r.proposal_id || ''}`;
      if (!cohortGrouped[key]) cohortGrouped[key] = [];
      cohortGrouped[key].push(r);
    }
    const cohortPairs = Object.values(cohortGrouped).flatMap(rows => matchPairs(rows, 'cohort_start', 'cohort_end').pairs);

    const challGrouped = {};
    for (const r of challengeRows) {
      const key = `${r.client_id}||${r.service_id || ''}`;
      if (!challGrouped[key]) challGrouped[key] = [];
      challGrouped[key].push(r);
    }
    const challPairs = Object.values(challGrouped).flatMap(rows => matchPairs(rows, 'challenge_day0', 'challenge_day14').pairs);

    return [...cohortPairs, ...challPairs];
  }, [cohortRows, challengeRows]);

  const makeToggle = (setter) => (field) =>
    setter(prev => ({ field, dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc' }));

  if (loadingA) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#013f7c] rounded-full animate-spin mr-3" />
        Loading WHO-5 data…
      </div>
    );
  }

  const noData = cohortRows.length === 0 && challengeRows.length === 0;

  if (noData) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-sm">
        <Activity className="w-16 h-16 mx-auto mb-4 text-gray-200" />
        <p className="text-lg font-semibold text-gray-600">No WHO-5 data matches the current filters.</p>
        <p className="text-sm text-gray-400 mt-1">Results appear once start and end responses are submitted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aggregate banner */}
      <AggBanner pairs={allPairs} />

      {/* By Cohort */}
      {cohortRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#770142]" />
            <h3 className="text-sm font-semibold text-gray-700">By Cohort — Year Arc</h3>
            <span className="text-xs text-gray-400">cohort_start → cohort_end · pre/post (uncontrolled)</span>
          </div>
          <CohortTable
            rows={cohortRows}
            clientMap={clientMap}
            sort={cohortSort}
            onSort={makeToggle(setCohortSort)}
          />
        </div>
      )}

      {/* By Challenge */}
      {challengeRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[#264d44]" />
            <h3 className="text-sm font-semibold text-gray-700">By Challenge — Program Effect</h3>
            <span className="text-xs text-gray-400">Day 0 → Day 14 · pre/post (uncontrolled)</span>
          </div>
          <ChallengeTable
            rows={challengeRows}
            clientMap={clientMap}
            serviceMap={serviceMap}
            sort={challengeSort}
            onSort={makeToggle(setChallengeSort)}
          />
        </div>
      )}
    </div>
  );
}