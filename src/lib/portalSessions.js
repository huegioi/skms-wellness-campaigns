/**
 * Frontend entry point — re-exports base44/shared/portalSessions.ts, the single
 * definition of which calendar events the portals show (program sessions only:
 * no meetings, follow-ups, deliveries or old-spreadsheet leftovers). The
 * backend portal functions import the same file.
 */
export { isPortalSession, isRemovedFromSchedule, NON_SESSION_EVENT_TYPES } from '../../base44/shared/portalSessions.ts';
