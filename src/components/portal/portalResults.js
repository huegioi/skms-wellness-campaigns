import { summarizeParticipation } from './ProgramParticipationChart';
import {
  getInstrumentKey, getScore, matchPairs, calcStats, calcBaseline, computeEnps, bandForScore,
} from '@/components/feedback/instrumentMeta';

const MIN_N = 5;

/**
 * Headline results (people engaged · eNPS · WHO-5 wellbeing) from a getRoiData
 * payload. Used by the client portal Home and the referral partner portal
 * (per client and across a whole book of business).
 */
export function summarizeResults(roiData, stats) {
  const feedback = roiData?.feedback_responses || [];
  const cohorts = roiData?.cohort_assessments || [];
  const participation = roiData?.participation || null;

  const partSummary = participation ? summarizeParticipation(participation) : null;
  const people = partSummary && partSummary.totalPrograms > 0 ? partSummary.totalPeople : (stats?.people_engaged ?? null);
  const programsWithPeople = partSummary?.totalPrograms || null;

  const pulse = feedback.filter(r => r.behavior_intent || r.fit_confidence != null);
  let enpsScores = cohorts.filter(r => getInstrumentKey(r) === 'enps').map(getScore).filter(s => s != null);
  if (!enpsScores.length) enpsScores = pulse.filter(r => r.nps_score != null).map(r => r.nps_score);
  const enps = computeEnps(enpsScores);

  const who5 = cohorts.filter(r => getInstrumentKey(r) === 'who5');
  const a = matchPairs(who5, 'cohort_start', ['cohort_end', 'session_check']);
  const b = matchPairs(who5, 'challenge_day0', 'challenge_day14');
  const pairs = [...a.pairs, ...b.pairs];
  let wellbeing = null;
  if (pairs.length >= MIN_N) {
    const st = calcStats(pairs, a.distinctStarts + b.distinctStarts, 'higher');
    wellbeing = { mode: 'change', value: st.avgDelta, n: st.n, isGood: st.isGood };
  } else {
    const base = calcBaseline(who5, 'cohort_start') || calcBaseline(who5, 'challenge_day0');
    if (base && base.n >= MIN_N) wellbeing = { mode: 'baseline', value: base.avgStart, n: base.n, band: bandForScore('who5', base.avgStart) };
  }
  const firstWho5 = who5.map(r => r.submitted_at).filter(Boolean).sort()[0] || null;
  const lastWho5 = who5.map(r => r.submitted_at).filter(Boolean).sort().slice(-1)[0] || null;
  return { people, programsWithPeople, enps, wellbeing, firstWho5, lastWho5, participation };
}
