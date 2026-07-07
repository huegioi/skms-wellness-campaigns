import { parseISO } from 'date-fns';

/**
 * Determines if an event is a multi-day challenge.
 * Checks event_type, the enriched service_category field (presenter portal),
 * or an explicitly passed serviceCategory (admin side, from allServices lookup).
 */
export function isChallengeEvent(event, serviceCategory) {
  if (!event) return false;
  return (
    event.event_type === 'challenge' ||
    event.service_category === 'challenge' ||
    serviceCategory === 'challenge'
  );
}

/**
 * Computes day-of-challenge progress from start/end dates.
 * Returns { totalDays, currentDay, isPastEnd, isFacilitating }.
 * - totalDays: inclusive count of days from start to end (min 1)
 * - currentDay: which day we're on right now (0 if not started yet)
 * - isPastEnd: true once end_date has passed (completion eligible)
 * - isFacilitating: true if started but not yet past end
 */
export function getChallengeDayProgress(event) {
  if (!event?.start_date) {
    return { totalDays: 0, currentDay: 0, isPastEnd: false, isFacilitating: false };
  }
  const start = new Date(event.start_date);
  const end = event.end_date ? new Date(event.end_date) : null;
  const now = new Date();

  if (isNaN(start.getTime())) {
    return { totalDays: 0, currentDay: 0, isPastEnd: false, isFacilitating: false };
  }

  // Single-day event (no end date or same-day) — past once start has passed
  if (!end || isNaN(end.getTime())) {
    const isPast = start <= now;
    return { totalDays: 1, currentDay: isPast ? 1 : 0, isPastEnd: isPast, isFacilitating: false };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((end - start) / msPerDay) + 1);
  const isPastEnd = end <= now;
  const isFacilitating = start <= now && !isPastEnd;

  let currentDay = 0;
  if (now >= start) {
    const daysSinceStart = Math.floor((now - start) / msPerDay);
    currentDay = Math.min(daysSinceStart + 1, totalDays);
  }

  return { totalDays, currentDay, isPastEnd, isFacilitating };
}