/**
 * Classification helpers for the SchedulingHub Delivery/Meetings lenses.
 */

/** Returns 'Sheet' | 'App' | 'Google' for the source badge. */
export function getEventSourceBadge(event) {
  if (event.source === 'sheet') return 'Sheet';
  if (event.ingested === true) return 'Google';
  return 'App';
}

/** Returns 'delivery' | 'meetings' — which lens the event belongs to. */
export function getEventLens(event) {
  if (event.source === 'sheet') return 'delivery';
  if (event.service_id || event.proposal_id) return 'delivery';
  return 'meetings';
}

/** Friendly label for the source_calendar field on ingested CalendarEvents. */
export function getSourceCalendarLabel(sourceCalendar) {
  if (!sourceCalendar) return null;
  if (sourceCalendar === 'primary') return 'William';
  if (sourceCalendar.includes('heather')) return 'Heather';
  if (sourceCalendar.includes('admin')) return 'Admin';
  return sourceCalendar;
}