import { getPlanYearWindow } from '@/lib/planYear';

// Shared utilities for check-in assessment flow.

/**
 * Maps assessment_timing to CohortAssessment survey_type.
 * - baseline → cohort_start (challenge_day0 for challenges)
 * - endpoint → cohort_end (challenge_day14 for challenges)
 */
export function getTimingSurveyType(timing, serviceCategory) {
  if (timing === 'baseline') {
    return serviceCategory === 'challenge' ? 'challenge_day0' : 'cohort_start';
  }
  if (timing === 'endpoint') {
    return serviceCategory === 'challenge' ? 'challenge_day14' : 'cohort_end';
  }
  return null;
}

/**
 * Selects at most 2 instruments for check-in: who5 first, then the
 * service's most specific (first non-who5) instrument.
 * Returns { instruments, skipped }.
 */
export function selectCheckinInstruments(includedAssessments) {
  if (!includedAssessments || includedAssessments.length === 0) {
    return { instruments: [], skipped: [] };
  }
  if (includedAssessments.length <= 2) {
    return { instruments: [...includedAssessments], skipped: [] };
  }
  const result = [];
  if (includedAssessments.includes('who5')) result.push('who5');
  const firstNonWho5 = includedAssessments.find(i => i !== 'who5');
  if (firstNonWho5) result.push(firstNonWho5);
  const skipped = includedAssessments.filter(i => !result.includes(i));
  return { instruments: result, skipped };
}

/**
 * Computes the smart default for assessment_timing.
 * Baseline is per CLIENT per PLAN YEAR (any service). After a baseline has been
 * taken in the current plan year, subsequent sessions are 'session' (or 'endpoint'
 * if the selected date is at/after the last existing event for this client+service).
 * - no baseline yet in this plan year → 'baseline'
 * - selected date >= last event for this client+service → 'endpoint'
 * - otherwise → 'session'
 * 'none' is reserved for manual suppression and is never returned here.
 */
export function computeSmartAssessmentTiming({ client, clientId, serviceId, events, selectedDate }) {
  if (!clientId || !serviceId) return 'none';
  const selected = selectedDate ? new Date(selectedDate) : new Date();
  if (isNaN(selected)) return 'session';
  const { start, end } = getPlanYearWindow(client, selected);

  const clientEvents = (events || [])
    .filter(e => e && e.client_id === clientId && !e.is_demo && e.start_date)
    .map(e => ({ e, d: new Date(e.start_date) }))
    .filter(x => !isNaN(x.d));

  // baselineTaken: any baseline event for this client within the plan year, before selectedDate
  const baselineTaken = clientEvents.some(({ e, d }) =>
    e.assessment_timing === 'baseline' && d >= start && d < end && d < selected
  );
  if (!baselineTaken) return 'baseline';

  // Scoped to this client + service: if selectedDate >= last event → endpoint, else session
  const serviceEvents = clientEvents
    .filter(({ e }) => e.service_id === serviceId)
    .sort((a, b) => a.d - b.d);
  if (serviceEvents.length === 0) return 'session';
  const lastEvent = serviceEvents[serviceEvents.length - 1].d;
  return selected >= lastEvent ? 'endpoint' : 'session';
}