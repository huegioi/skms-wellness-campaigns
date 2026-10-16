/**
 * Which calendar events the client-facing portals show — the HR client portal
 * and the referral partner portal. Single definition: getClientPortalData,
 * getReferralPortalData and the portal timeline (src/lib/portalSessions.js)
 * all import this file.
 *
 * The portals list program sessions only: workshops, challenges, classes,
 * presentations. Two kinds of calendar record are left out:
 *
 *  - Meetings, follow-ups and wellness-box deliveries. Calendar ingestion
 *    attaches sales calls, coaching sessions, podcast recordings and the Zoom
 *    invites for sessions to client records as 'meeting' events. Those are
 *    internal (titles, attendees, passcodes), and the Zoom-invite copies repeat
 *    sessions that are already on the schedule.
 *  - Leftovers from the retired scheduling spreadsheet. mirrorSheetEvents tagged
 *    an upcoming session "[Removed from sheet …]" when its row came off the
 *    schedule but the record had a client link or check-ins, so a tagged record
 *    is a session that was cancelled or re-entered — not one on the schedule.
 */

type PortalEventLike = {
  event_type?: string | null;
  description?: string | null;
} | null | undefined;

export const NON_SESSION_EVENT_TYPES: string[] = ['meeting', 'follow_up', 'delivery'];

export function isRemovedFromSchedule(event: PortalEventLike): boolean {
  return String(event?.description || '').includes('[Removed from sheet');
}

export function isPortalSession(event: PortalEventLike): boolean {
  if (!event) return false;
  if (NON_SESSION_EVENT_TYPES.includes(String(event.event_type || ''))) return false;
  return !isRemovedFromSchedule(event);
}
