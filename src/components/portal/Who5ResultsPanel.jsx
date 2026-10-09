import React, { useMemo } from 'react';
import { Activity, CalendarCheck, ThumbsUp } from 'lucide-react';
import ScoreBandRow, { ScoreBandLegend } from '@/components/feedback/ScoreBandRow';
import { INSTRUMENT_META, INSTRUMENT_ORDER, getInstrumentKey, getScore, matchPairs, calcStats, calcBaseline, computeEnps } from '@/components/feedback/instrumentMeta';

// Portal privacy rule: never render a result built on fewer than 5 people.
const MIN_N = 5;

const orderOf = (key) => {
  const i = INSTRUMENT_ORDER.indexOf(key);
  return i === -1 ? INSTRUMENT_ORDER.length : i;
};

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
  }).filter(s => s.stats).sort((a, b) => orderOf(a.key) - orderOf(b.key));
}

// Shown in place of a result row when n < 5 (portal min-N suppression).
function InstrumentSuppressedRow({ instrumentKey, n }) {
  const meta = INSTRUMENT_META[instrumentKey];
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">{meta?.short || instrumentKey}</p>
        <p className="text-[11px] text-gray-400">{meta?.code || ''}</p>
      </div>
      <p className="text-xs text-gray-400 italic">Collecting data (n={n})</p>
    </div>
  );
}

// One section: a card of visual result rows (each opens to its raw score),
// with a shared empty state.
function InstrumentSection({ icon: Icon, iconClass, title, subtitle, stats, evidenceTier, emptyText, startLabel, endLabel }) {
  const followUp = stats.some(({ stats: s }) => !s.baselineOnly && s.n >= MIN_N);
  const sub = typeof subtitle === 'function' ? subtitle(followUp) : subtitle;
  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="px-5 pt-5 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${iconClass}`} />
            <p className="text-sm font-semibold text-gray-700">{title}</p>
          </div>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
        {stats.length > 0 && <div className="sm:pt-1 shrink-0"><ScoreBandLegend followUp={followUp} /></div>}
      </div>
      {stats.length > 0 ? (
        <div className="mt-2 pb-1 divide-y divide-gray-100">
          {stats.map(({ key, stats: s }) => (
            s.n < MIN_N
              ? <InstrumentSuppressedRow key={key} instrumentKey={key} n={s.n} />
              : <ScoreBandRow key={key} instrumentKey={key} stats={s} evidenceTier={evidenceTier} startLabel={startLabel} endLabel={endLabel} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic px-5 py-4">{emptyText}</p>
      )}
    </div>
  );
}

const OPEN_HINT = 'Open any row for the raw score and what it means.';

/**
 * part:
 *  - 'all' (default): every section, as before.
 *  - 'primary': only the headline arc (the plan-year cohort arc, or the
 *    challenge arc when there is no cohort data) — shown up front on the
 *    dashboard.
 *  - 'secondary': everything else — lives in the collapsible details.
 */
export default function Who5ResultsPanel({ cohortAssessments = [], acceptedProposalId, services = [], part = 'all' }) {
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

  // ── Section 2: By challenge ────────────────────────────────────────────────
  const challengeRows = useMemo(() =>
    cohortRows.filter(r => r.survey_type === 'challenge_day0' || r.survey_type === 'challenge_day14'),
    [cohortRows]
  );
  const challengeInstrumentStats = useMemo(
    () => buildInstrumentStats(challengeRows, 'challenge_day0', 'challenge_day14'),
    [challengeRows]
  );

  // Section: Advocacy (eNPS). Single-point measure, not a pre/post pair, so it
  // gets its own breakdown rather than a result row.
  const enpsBreakdown = useMemo(() => {
    const scores = cohortRows
      .filter(r => getInstrumentKey(r) === 'enps')
      .map(r => getScore(r))
      .filter(s => s != null);
    return computeEnps(scores);
  }, [cohortRows]);

  const primaryKey = cohortRows_.length > 0 ? 'cohort' : (challengeRows.length > 0 ? 'challenge' : null);
  const inPart = (key) => part === 'all' || (part === 'primary' ? key === primaryKey : key !== primaryKey);
  if (part === 'primary' && !primaryKey) return null;

  const sections = [];
  if (cohortRows_.length > 0 && inPart('cohort')) {
    sections.push(
      <InstrumentSection
        key="cohort"
        icon={Activity}
        iconClass="text-brand-plum"
        title="Wellbeing — This Plan Year"
        subtitle={(followUp) => followUp
          ? `Start of the plan year vs. the latest check-in, same people matched. ${OPEN_HINT}`
          : `Where your team started on each survey, against its research range. ${OPEN_HINT}`}
        stats={cohortInstrumentStats}
        startLabel="Before"
        endLabel="After"
        evidenceTier="Matched comparison"
        emptyText="Cohort results appear once Cohort Start and Cohort End responses come in."
      />
    );
  }
  if (hasSustainResponses && inPart('sustain')) {
    sections.push(
      <InstrumentSection
        key="sustain"
        icon={CalendarCheck}
        iconClass="text-brand-navy"
        title="Sustained — One Month Later"
        subtitle={`Program start vs. one month after the program ended, same people matched. ${OPEN_HINT}`}
        stats={sustainInstrumentStats}
        startLabel="Before"
        endLabel="1 Month After"
        evidenceTier="Matched comparison — 1-month follow-up"
        emptyText="Sustain results appear once one-month follow-up responses come in."
      />
    );
  }
  if (inPart('challenge')) {
    sections.push(
      <InstrumentSection
        key="challenge"
        icon={Activity}
        iconClass="text-brand-green"
        title="Challenge Wellbeing — By Program"
        subtitle={`Day 0 vs. Day 14 of each challenge (uncontrolled pre/post). ${OPEN_HINT}`}
        stats={challengeInstrumentStats}
        startLabel="Day 0"
        endLabel="Day 14"
        evidenceTier="Program effect — uncontrolled pre/post"
        emptyText="Challenge results appear once Day 0 and Day 14 responses come in."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sections}

      {/* Advocacy — eNPS (single-point, not a before/after pair) */}
      {enpsBreakdown.n > 0 && inPart('enps') && (
        <div className="bg-white rounded-xl shadow-sm p-5">
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
