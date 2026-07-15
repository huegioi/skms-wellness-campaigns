/**
 * Classification helpers for the SchedulingHub Delivery/Meetings lenses.
 */

const DELIVERY_TYPES = ['workshop', 'challenge', 'class', 'leadership', 'presentation', 'delivery'];
const DELIVERY_KEYWORDS = ['workshop', 'challenge', 'class', 'training', 'presentation', 'lunch & learn', 'lunch and learn'];

/** Returns 'Sheet' | 'App' | 'Google' for the source badge. */
export function getEventSourceBadge(event) {
  if (event.source === 'sheet' || event.source_calendar === 'sheet') return 'Sheet';
  if (event.ingested === true) return 'Google';
  return 'App';
}

/** Returns 'delivery' | 'meetings' — which lens the event belongs to. */
export function getEventLens(event) {
  // Schedule sheet events are always delivery
  if (event.source === 'sheet' || event.source_calendar === 'sheet') return 'delivery';
  // Rule 1: classify by event_type first (workshops, challenges, etc.)
  if (event.event_type && DELIVERY_TYPES.includes(event.event_type)) return 'delivery';
  // Service / proposal linkage → delivery
  if (event.service_id || event.proposal_id) return 'delivery';
  // Rule 2: keyword fallback for legacy rows (missing or 'other' type)
  if ((!event.event_type || event.event_type === 'other') && event.title) {
    const lower = event.title.toLowerCase();
    if (DELIVERY_KEYWORDS.some(kw => lower.includes(kw))) return 'delivery';
  }
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