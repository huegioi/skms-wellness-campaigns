import { serviceForEvent } from './timelineItems';
import { resourceAvailability } from '@/lib/resourceAvailability';

export const SESSION_SELECTION_KEYS = ['workshops', 'challengePrograms', 'leadership', 'movementClasses'];
export const NON_PROGRAM_TYPES = new Set(['meeting', 'follow_up', 'delivery']);

/**
 * Per purchased program (accepted-proposal selections): delivered / booked /
 * not yet scheduled. "Delivered" uses the same held-session rule as resource
 * unlocking (shared/resourceAvailability.ts). Shared by the client portal Home
 * and the referral partner portal's client cards.
 */
export function programStatuses(proposals = [], services = [], events = []) {
  const ids = [];
  for (const p of proposals.filter(p => p.status === 'accepted')) {
    const sel = p.selections || {};
    for (const k of SESSION_SELECTION_KEYS) for (const id of (sel[k] || [])) if (id && !ids.includes(id)) ids.push(id);
  }
  const now = Date.now();
  return ids.map(id => services.find(s => s.id === id)).filter(Boolean).map(svc => {
    const sessions = events.filter(e => !NON_PROGRAM_TYPES.has(e.event_type) && serviceForEvent(e, services)?.id === svc.id);
    const delivered = sessions.length > 0 && resourceAvailability(svc, sessions).available;
    const future = sessions.filter(e => new Date(e.start_date).getTime() > now)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const lastHeld = sessions.filter(e => new Date(e.end_date || e.start_date).getTime() <= now)
      .sort((a, b) => new Date(b.end_date || b.start_date) - new Date(a.end_date || a.start_date))[0];
    return {
      service: svc,
      status: delivered ? 'delivered' : future.length ? 'booked' : 'unscheduled',
      nextDate: future[0]?.start_date || null,
      lastHeldDate: lastHeld ? (lastHeld.end_date || lastHeld.start_date) : null,
    };
  });
}

export function statusCounts(programs = []) {
  return {
    delivered: programs.filter(p => p.status === 'delivered').length,
    booked: programs.filter(p => p.status === 'booked').length,
    unscheduled: programs.filter(p => p.status === 'unscheduled').length,
  };
}
