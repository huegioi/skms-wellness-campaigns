import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Zap, TrendingUp, Gauge } from 'lucide-react';
import InstrumentResultCard from './InstrumentResultCard';
import WellbeingProfile from './WellbeingProfile';
import ReachCard from './ReachCard';
import MethodologyNote from './MethodologyNote';
import { INSTRUMENT_META, getInstrumentKey, matchPairs, calcStats } from './instrumentMeta';

const COMPANY_SIZE_MIDPOINTS = {
  '1-50': 25,
  '51-200': 125,
  '201-500': 350,
  '501-1000': 750,
  '1001-5000': 3000,
  '5000+': 5000,
};

const LEADING_INSTRUMENTS = ['enps'];
const LAGGING_INSTRUMENTS = ['who5', 'uwes3', 'pss4', 'ucla3', 'cbi'];

function EmptyState({ message }) {
  return (
    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
      <Activity className="w-16 h-16 mx-auto mb-4 text-gray-200" />
      <p className="text-lg font-semibold text-gray-600">{message}</p>
      <p className="text-sm text-gray-400 mt-1">Results appear once start and end responses are submitted.</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, color = '#013f7c' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4" style={{ color }} />
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <span className="text-xs text-gray-400">{subtitle}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, subtitle, color = '#013f7c' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <p className="text-sm font-semibold text-gray-700">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// Compute combined matched-pair stats across cohort + challenge for a set of rows.
function buildCombinedStats(rows) {
  const byInstrument = {};
  for (const r of rows) {
    const key = getInstrumentKey(r);
    if (!byInstrument[key]) byInstrument[key] = [];
    byInstrument[key].push(r);
  }
  return Object.entries(byInstrument).map(([key, rows]) => {
    const cohortResult = matchPairs(rows, 'cohort_start', 'cohort_end');
    const challengeResult = matchPairs(rows, 'challenge_day0', 'challenge_day14');
    const allPairs = [...cohortResult.pairs, ...challengeResult.pairs];
    const allDistinct = cohortResult.distinctStarts + challengeResult.distinctStarts;
    const meta = INSTRUMENT_META[key];
    const stats = calcStats(allPairs, allDistinct, meta?.directionOfGood || 'higher');
    return { key, stats };
  }).filter(s => s.stats);
}

export default function Who5Analytics({ filters }) {
  const { data: allAssessments = [], isLoading: loadingA } = useQuery({
    queryKey: ['cohort-assessments-all'],
    queryFn: () => base44.entities.CohortAssessment.list('-submitted_at', 2000),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list-compact'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
  });

  const { data: pulseResponses = [] } = useQuery({
    queryKey: ['feedback-responses-all'],
    queryFn: () => base44.entities.FeedbackResponse.list('-submitted_at', 1000),
  });

  // ── Apply filters to assessments ────────────────────────────────────────────
  const filteredAssessments = useMemo(() => {
    return allAssessments.filter(r => {
      if (filters.company !== 'all') {
        const matchingClientIds = clients.filter(c => (c.company || c.name) === filters.company).map(c => c.id);
        if (!matchingClientIds.includes(r.client_id)) return false;
      }
      if (filters.cohortYear !== 'all') {
        const year = r.cohort_year || (r.submitted_at ? new Date(r.submitted_at).getFullYear() : null);
        if (String(year) !== filters.cohortYear) return false;
      }
      if (filters.startDate && r.submitted_at && r.submitted_at.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate   && r.submitted_at && r.submitted_at.slice(0, 10) > filters.endDate)   return false;
      if (filters.touchpoint && filters.touchpoint !== 'all' && filters.touchpoint !== 'session_pulse') {
        const touchpointMap = { day0: 'challenge_day0', day14: 'challenge_day14', cohort_start: 'cohort_start', cohort_end: 'cohort_end' };
        if (touchpointMap[filters.touchpoint] && r.survey_type !== touchpointMap[filters.touchpoint]) return false;
      }
      return true;
    });
  }, [allAssessments, filters, clients]);

  const instrumentFilter = filters.instrument && filters.instrument !== 'all' && filters.instrument !== 'pulse';

  const cohortRows = useMemo(() =>
    filteredAssessments.filter(r =>
      (r.survey_type === 'cohort_start' || r.survey_type === 'cohort_end') &&
      (!instrumentFilter || getInstrumentKey(r) === filters.instrument)
    ),
    [filteredAssessments, instrumentFilter, filters.instrument]
  );

  const challengeRows = useMemo(() => {
    let rows = filteredAssessments.filter(r =>
      (r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14') &&
      (!instrumentFilter || getInstrumentKey(r) === filters.instrument)
    );
    if (filters.category !== 'all' && filters.category !== 'challenge') rows = [];
    return rows;
  }, [filteredAssessments, filters.category, instrumentFilter, filters.instrument]);

  // Combined stats across cohort + challenge
  const allRows = useMemo(() => [...cohortRows, ...challengeRows], [cohortRows, challengeRows]);
  const combinedStats = useMemo(() => buildCombinedStats(allRows), [allRows]);

  const leadingStats = combinedStats.filter(s => LEADING_INSTRUMENTS.includes(s.key));
  const laggingStats = combinedStats.filter(s => LAGGING_INSTRUMENTS.includes(s.key));

  // ── Reach / representativeness ─────────────────────────────────────────────
  const reachData = useMemo(() => {
    const responderEmails = new Set();
    for (const r of filteredAssessments) {
      const email = (r.participant_email || '').toLowerCase().trim();
      if (email) responderEmails.add(email);
    }
    const responderCount = responderEmails.size;

    // Compute eligible population from company_size midpoints
    const clientIds = new Set(filteredAssessments.map(r => r.client_id).filter(Boolean));
    let eligibleCount = 0;
    let hasRoster = false;
    for (const c of clients) {
      if (clientIds.has(c.id) && c.company_size) {
        const mid = COMPANY_SIZE_MIDPOINTS[c.company_size];
        if (mid) {
          eligibleCount += mid;
          hasRoster = true;
        }
      }
    }

    return { responderCount, eligibleCount, hasRoster };
  }, [filteredAssessments, clients]);

  // ── Completion rate ──────────────────────────────────────────────────────────
  const completionData = useMemo(() => {
    const starterEmails = new Set();
    const endEmails = new Set();
    for (const r of allRows) {
      const email = (r.participant_email || '').toLowerCase().trim();
      if (!email) continue;
      if (r.survey_type === 'cohort_start' || r.survey_type === 'challenge_day0') starterEmails.add(email);
      if (r.survey_type === 'cohort_end' || r.survey_type === 'challenge_day14') endEmails.add(email);
    }
    const distinctStarters = starterEmails.size;
    const distinctEnds = endEmails.size;
    const completion = distinctStarters > 0 ? Math.round((distinctEnds / distinctStarters) * 100) : 0;
    return { completion, distinctStarters, distinctEnds };
  }, [allRows]);

  // ── Session pulse summary ────────────────────────────────────────────────────
  const pulseSummary = useMemo(() => {
    const filtered = pulseResponses.filter(r => {
      if (filters.company !== 'all' && r.company_name !== filters.company) return false;
      if (filters.category !== 'all' && r.service_category !== filters.category) return false;
      if (filters.cohortYear !== 'all') {
        const year = r.submitted_at ? new Date(r.submitted_at).getFullYear() : null;
        if (String(year) !== filters.cohortYear) return false;
      }
      if (filters.startDate && r.submitted_at && r.submitted_at.slice(0, 10) < filters.startDate) return false;
      if (filters.endDate && r.submitted_at && r.submitted_at.slice(0, 10) > filters.endDate) return false;
      return true;
    });
    const withConf = filtered.filter(r => r.fit_confidence != null);
    const avgConf = withConf.length ? withConf.reduce((s, r) => s + r.fit_confidence, 0) / withConf.length : null;
    const intentCount = filtered.filter(r => r.behavior_intent?.trim()).length;
    return { count: filtered.length, avgConf, intentCount };
  }, [pulseResponses, filters]);

  if (loadingA) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#013f7c] rounded-full animate-spin mr-3" />
        Loading assessment data…
      </div>
    );
  }

  if (filteredAssessments.length === 0 && pulseSummary.count === 0) {
    return <EmptyState message="No data matches the current filters." />;
  }

  return (
    <div className="space-y-6">
      <WellbeingProfile assessments={filteredAssessments} />

      {/* Leading Indicators */}
      <div>
        <SectionHeader
          icon={Zap}
          title="Leading Indicators"
          subtitle="Engagement and immediate reaction — turn early, predict downstream change"
          color="#013f7c"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReachCard
            responderCount={reachData.responderCount}
            eligibleCount={reachData.eligibleCount}
            hasRoster={reachData.hasRoster}
          />
          <MetricCard
            icon={TrendingUp}
            label="Session Pulse"
            value={pulseSummary.count || '—'}
            subtitle={pulseSummary.avgConf != null
              ? `${pulseSummary.avgConf.toFixed(1)}/10 avg confidence · ${pulseSummary.intentCount} intent statements`
              : 'No pulse data for these filters'}
            color="#264d44"
          />
          {leadingStats.map(({ key, stats }) => (
            <InstrumentResultCard
              key={key}
              instrumentKey={key}
              stats={stats}
              evidenceTier="Program effect — uncontrolled pre/post"
            />
          ))}
          <MetricCard
            icon={Gauge}
            label="Completion Rate"
            value={completionData.distinctStarters > 0 ? `${completionData.completion}%` : '—'}
            subtitle={completionData.distinctStarters > 0
              ? `${completionData.distinctEnds} completers ÷ ${completionData.distinctStarters} starters`
              : 'No start/end data'}
            color="#770142"
          />
        </div>
      </div>

      {/* Lagging Indicators */}
      {laggingStats.length > 0 && (
        <div>
          <SectionHeader
            icon={Activity}
            title="Lagging Indicators"
            subtitle="Validated wellbeing instruments — move slowly, shown as pre→post deltas"
            color="#264d44"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {laggingStats.map(({ key, stats }) => (
              <InstrumentResultCard
                key={key}
                instrumentKey={key}
                stats={stats}
                evidenceTier="Program effect — uncontrolled pre/post"
              />
            ))}
          </div>
        </div>
      )}

      {/* Honest-framing footer */}
      <div className="rounded-xl p-4 border border-[#e6e1d8] text-center" style={{ backgroundColor: '#f9f8f5' }}>
        <p className="text-xs text-gray-600 italic">
          These results reflect participants who completed assessments. They are not a randomized controlled trial — changes may reflect program effects, natural variation, or external factors. Small samples should be interpreted with caution.
        </p>
      </div>

      {/* Methodology note */}
      <MethodologyNote />
    </div>
  );
}