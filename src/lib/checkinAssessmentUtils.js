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
 * - 0 existing events for this client+service → 'baseline'
 * - Selected date is on or after the last existing event → 'endpoint'
 * - Otherwise → 'none'
 */
export function computeSmartAssessmentTiming({ clientId, serviceId, events, selectedDate }) {
  if (!clientId || !serviceId) return 'none';
  const serviceEvents = (events || [])
    .filter(e => e.client_id === clientId && e.service_id === serviceId && !e.is_demo)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  if (serviceEvents.length === 0) return 'baseline';
  if (selectedDate) {
    const selected = new Date(selectedDate);
    const lastEvent = new Date(serviceEvents[serviceEvents.length - 1].start_date);
    if (selected >= lastEvent) return 'endpoint';
  }
  return 'none';
}