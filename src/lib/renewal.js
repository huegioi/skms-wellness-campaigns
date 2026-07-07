// Shared renewal-date resolver used by boards, dashboard, and the autoStageDetection
// automation. The logic is ported into base44/functions/autoStageDetection/entry.ts —
// keep them in sync.

const RAMP_DAYS = 90;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

function nextCohortDate(now, monthIndex, day) {
  const year = now.getFullYear();
  let d = new Date(year, monthIndex, day);
  if (d < now) d = new Date(year + 1, monthIndex, day);
  return d;
}

function nextAnniversary(now, baseStr) {
  if (!baseStr) return null;
  const base = new Date(baseStr);
  if (isNaN(base.getTime())) return null;
  const year = now.getFullYear();
  let d = new Date(year, base.getMonth(), base.getDate());
  if (isNaN(d.getTime())) d = new Date(year, base.getMonth(), 15);
  if (d < now) {
    d = new Date(year + 1, base.getMonth(), base.getDate());
    if (isNaN(d.getTime())) d = new Date(year + 1, base.getMonth(), 15);
  }
  return d;
}

/**
 * Resolve a client's effective renewal date.
 *  - cohort "Jan 1"   → next Jan 1
 *  - cohort "July 1"  → next July 1
 *  - cohort "Off-Cycle" (or none) → renewal_date, else plan_year_start anniversary
 *  - null if none can be derived
 */
export function getEffectiveRenewalDate(client, now = new Date()) {
  if (!client) return null;
  const cohort = client.renewal_cohort;
  if (cohort === 'Jan 1') return nextCohortDate(now, 0, 1);
  if (cohort === 'July 1') return nextCohortDate(now, 6, 1);
  if (client.renewal_date) {
    const d = new Date(client.renewal_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (client.plan_year_start) return nextAnniversary(now, client.plan_year_start);
  return null;
}

/** Whole days until renewal, or null if past / undetermined. */
export function daysUntilRenewal(client, now = new Date()) {
  const d = getEffectiveRenewalDate(client, now);
  if (!d) return null;
  const days = daysBetween(now, d);
  return days < 0 ? null : days;
}

export function isInRenewalRamp(client, now = new Date(), rampDays = RAMP_DAYS) {
  const days = daysUntilRenewal(client, now);
  return days !== null && days <= rampDays;
}

/**
 * If today is within RAMP_DAYS before a Jan 1 / July 1 cohort date, return
 * { label, date, daysRemaining }. Otherwise null. (Jan 1 & July 1 are ~6 months
 * apart, so at most one is ever in ramp.)
 */
export function getActiveCohort(now = new Date(), rampDays = RAMP_DAYS) {
  const jan1 = nextCohortDate(now, 0, 1);
  const jul1 = nextCohortDate(now, 6, 1);
  const dJan = daysBetween(now, jan1);
  const dJul = daysBetween(now, jul1);
  if (dJan >= 0 && dJan <= rampDays) return { label: 'Jan 1', date: jan1, daysRemaining: dJan };
  if (dJul >= 0 && dJul <= rampDays) return { label: 'July 1', date: jul1, daysRemaining: dJul };
  return null;
}

/**
 * "Review booked" = an upcoming CalendarEvent for the client with 'renewal' in
 * the title or a renewal event_type (if one exists). Pass the bulk events list.
 */
export function hasRenewalReviewBooked(client, events, now = new Date()) {
  if (!client || !events) return false;
  const startOfToday = startOfDay(now).getTime();
  return events.some((e) => {
    if (e.client_id !== client.id) return false;
    if (!e.start_date) return false;
    const evDate = new Date(e.start_date);
    if (isNaN(evDate.getTime())) return false;
    if (evDate < startOfToday) return false;
    const titleMatch = (e.title || '').toLowerCase().includes('renewal');
    const typeMatch = (e.event_type || '').toLowerCase() === 'renewal';
    return titleMatch || typeMatch;
  });
}