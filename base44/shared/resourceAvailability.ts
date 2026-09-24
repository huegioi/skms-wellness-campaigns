/**
 * When does a client get a service's resources (recordings, slides, handouts)?
 *
 * Rule (William, 2026-09-24): resources are available ONLY AFTER that client's
 * scheduled session for the service has taken place.
 *   - Workshops / classes / leadership / presentations: unlocked once the
 *     session has ENDED (end_date, falling back to start_date).
 *   - Challenges: unlocked once the challenge has STARTED (participants need
 *     the materials during the 14 days).
 *   - Wellness boxes: no session — always available.
 *   - Meetings never count as a session.
 *
 * One definition, used by BOTH the backend (getClientPortalData strips file
 * links from locked resources so they never leave the server) and the portal
 * UI (src/lib/resourceAvailability.js re-exports this file).
 */

export type AvailabilityEvent = {
  service_id?: string | null;
  service_name?: string | null;
  event_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type ServiceLike = { id: string; name?: string | null; category?: string | null };

export type Availability = {
  available: boolean;
  /** ISO date the resources unlock, when a future session is scheduled. */
  availableAfter: string | null;
};

const ALWAYS_AVAILABLE_CATEGORIES = new Set(['wellness_box']);

function unlockTime(e: AvailabilityEvent): number | null {
  const iso = e.event_type === 'challenge' ? e.start_date : (e.end_date || e.start_date);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function resourceAvailability(
  service: ServiceLike,
  events: AvailabilityEvent[],
  now: number = Date.now(),
): Availability {
  if (service.category && ALWAYS_AVAILABLE_CATEGORIES.has(service.category)) {
    return { available: true, availableAfter: null };
  }
  const name = (service.name || '').trim().toLowerCase();
  const sessions = (events || []).filter(e =>
    e && e.event_type !== 'meeting' &&
    ((e.service_id && e.service_id === service.id) ||
     (!e.service_id && name && (e.service_name || '').trim().toLowerCase() === name))
  );
  let nextUnlock: number | null = null;
  for (const e of sessions) {
    const t = unlockTime(e);
    if (t == null) continue;
    if (t <= now) return { available: true, availableAfter: null };
    if (nextUnlock == null || t < nextUnlock) nextUnlock = t;
  }
  return { available: false, availableAfter: nextUnlock != null ? new Date(nextUnlock).toISOString() : null };
}
