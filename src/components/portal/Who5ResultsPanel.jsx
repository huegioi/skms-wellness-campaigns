import React, { useMemo } from 'react';
import { Activity, CalendarCheck, ThumbsUp } from 'lucide-react';
import InstrumentResultCard from '@/components/feedback/InstrumentResultCard';
import { INSTRUMENT_META, getInstrumentKey, getScore, matchPairs, calcStats, calcBaseline, computeEnps } from '@/components/feedback/instrumentMeta';

// Portal privacy rule: never render a result built on fewer than 5 people.
const MIN_N = 5;

function buildInstrumentStats(rows, startType, endType) {
  const byInstrument = {};
  for (const r of rows) {
    const key = getInstrumentKey(r);
    if (!byInstrument[key]) byInstrument[key] = [];
    byInstrument[key].push(r);
  }
  return Object.entries(byInstrument).map(([key, rows]) => {
    const { pairs, distinctStarts } = matchPairs(rows, startType, endType);
    const meta = INSTRUMENT_META[key];
    // Matched pre/post stats when follow-ups exist; otherwise fall back to the
    // baseline picture so clients see their starting numbers right away instead
    // of an empty section until the end-of-program survey happens.
    const stats = calcStats(pairs, distinctStarts, meta?.directionOfGood || 'higher')
      || calcBaseline(rows, startType);
    return { key, stats };
  }).filter(s => s.stats);
}

// Shown in place of an InstrumentResultCard when n < 5 (portal min-N suppression).
function InstrumentSuppressedCard({ instrumentKey, n }) {
  const label = INSTRUMENT_META[instrumentKey]?.label || instrumentKey;
  return (
    <div className="border rounded-lg p-3">
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <span className="text-xs text-gray-400">n={n}</span>
      </div>
      <p className="text-xs text-gray-400 italic">Collecting data (n={n})</p>
    </div>
  );
}

// One section of matched-pair instrument cards, with a shared empty state.
function InstrumentSection({ icon: Icon, iconClass, title, subtitle, stats, evidenceTier, emptyText, startLabel, endLabel }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <p className="text-sm font-semibold text-gray-700">{title}</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      {stats.length > 0 ? (
        <div className="grid gap-3">
          {stats.map(({ key, stats: s }) => (
            s.n < MIN_N
              ? <InstrumentSuppressedCard key={key} instrumentKey={key} n={s.n} />
              : <InstrumentResultCard key={key} instrumentKey={key} stats={s} evidenceTier={evidenceTier} startLabel={startLabel} endLabel={endLabel} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic py-3">{emptyText}</p>
      )}
    </div>
  );
}

export default function Who5ResultsPanel({ cohortAssessments = [], acceptedProposalId, services = [] }) {
  const cohortRows = cohortAssessments;

  // ── Section 1: Cohort arc ──────────────────────────────────────────────────
  const cohortRows_ = useMemo(() =>
    cohortRows.filter(r =>
      r.survey_type === 'cohort_start' || r.survey_type === 'cohort_end' || r.survey_type === 'session_check'
    ),
    [cohortRows]
  );
  const cohortInstrumentStats = useMemo(
    () => buildInstrumentStats(cohortRows_, 'cohort_start', ['cohort_end', 'session_check']),
    [cohortRows_]
  );

  // ── Section 2: By challenge ────────────────────────────────────────────────
  // Section: 1-month sustain. Baseline vs. one month AFTER the program ended.
  // Kept separate from the year arc so the follow-up survey is never confused
  // with the end-of-program one.
  const sustainRows = useMemo(() =>
    cohortRows.filter(r => r.survey_type === 'cohort_start' || r.survey_type === 'cohort_1mo'),
    [cohortRows]
  );
  const sustainInstrumentStats = useMemo(
    () => buildInstrumentStats(sustainRows, 'cohort_start', ['cohort_1mo']),
    [sustainRows]
  );
  const hasSustainResponses = useMemo(
    () => cohortRows.some(r => r.survey_type === 'cohort_1mo'),
    [cohortRows]
  );

  const challengeRows = useMemo(() =>
    cohortRows.filter(r => r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14'),
    [cohortRows]
  );
  const challengeInstrumentStats = useMemo(
    () => buildInstrumentStats(challengeRows, 'challenge_day0', 'challenge_day14'),
    [challengeRows]
  );

  // Section: Advocacy (eNPS). Single-point measure, not a pre/post pair, so it
  // gets its own breakdown rather than an InstrumentResultCard.
  const enpsBreakdown = useMemo(() => {
    const scores = cohortRows
      .filter(r => getInstrumentKey(r) === 'enps')
      .map(r => getScore(r))
      .filter(s => s != null);
    return computeEnps(scores);
  }, [cohortRows]);

  return (
    <div className="space-y-4">
      {/* ── Section 1: Cohort arc ───────────────────────────────────────────── */}
      {cohortRows_.length > 0 && (
        <InstrumentSection
          icon={Activity}
          iconClass="text-brand-plum"
          title="Wellbeing — This Plan Year"
          subtitle="Year arc — matched comparison of program start vs. program end"
          stats={cohortInstrumentStats}
          startLabel="Before"
          endLabel="After"
          evidenceTier="Matched comparison"
          emptyText="Cohort results appear once Cohort Start and Cohort End responses come in."
        />
      )}

      {/* 1-month sustain — baseline vs. one month after the program ended */}
      {hasSustainResponses && (
        <InstrumentSection
          icon={CalendarCheck}
          iconClass="text-brand-navy"
          title="Sustained — One Month Later"
          subtitle="Follow-up arc — program start vs. one month after the program ended"
          stats={sustainInstrumentStats}
          startLabel="Before"
          endLabel="1 Month After"
          evidenceTier="Matched comparison — 1-month follow-up"
          emptyText="Sustain results appear once one-month follow-up responses come in."
        />
      )}

      {/* ── Section 2: By challenge ─────────────────────────────────────────── */}
      <InstrumentSection
        icon={Activity}
        iconClass="text-brand-green"
        title="Challenge Wellbeing — By Program"
        subtitle="Program effect — uncontrolled pre/post (Day 0 vs. Day 14)"
        stats={challengeInstrumentStats}
        startLabel="Day 0"
        endLabel="Day 14"
        evidenceTier="Program effect — uncontrolled pre/post"
        emptyText="Challenge results appear once Day 0 and Day 14 responses come in."
      />

      {/* Advocacy — eNPS (single-point, not a before/after pair) */}
      {enpsBreakdown.n > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ThumbsUp className="w-4 h-4 text-brand-navy" />
            <p className="text-sm font-semibold text-gray-700">Advocacy — eNPS</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">Post-session advocacy — single-point measure, not a before/after comparison</p>
          <div className="border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-gray-800">eNPS Advocacy</p>
              <span className="text-xs text-gray-400">n={enpsBreakdown.n}</span>
            </div>
            {enpsBreakdown.n < MIN_N ? (
              <p className="text-xs text-gray-400 italic">Collecting data (n={enpsBreakdown.n})</p>
            ) : (
              <>
                <p className="text-2xl font-bold text-brand-navy mb-2">
                  {enpsBreakdown.enps >= 0 ? '+' : ''}{enpsBreakdown.enps}
                </p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span><span className="font-semibold text-brand-green">{enpsBreakdown.promoters}</span> promoters</span>
                  <span><span className="font-semibold text-gray-600">{enpsBreakdown.passives}</span> passives</span>
                  <span><span className="font-semibold text-red-500">{enpsBreakdown.detractors}</span> detractors</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}