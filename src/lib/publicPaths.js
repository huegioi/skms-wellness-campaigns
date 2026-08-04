// Paths that render without authentication (portals, public forms, Quick Builder).
// Keep in sync with Layout.jsx PUBLIC_PAGES.
export const PUBLIC_PATHS = [
  '/ReferralPortal',
  '/ViewProposal',
  '/FeedbackForm',
  '/ClientPortal',
  '/AttendeeForm',
  '/ClientReport',
  '/PresenterPortal',
  '/CohortAssessment',
  '/QuickBuilder',
  '/MyPortal',
  '/Checkin',
  '/MentalFitnessScore',
  '/MfsSurvey',
  '/MfsResults',
  '/FitnessRoi',
  '/MfsJourneySurvey',
  '/Unsubscribe',
];

export function isPublicPath(pathname) {
  const path = (pathname || (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  if (!path) return false;
  return PUBLIC_PATHS.some((p) => {
    const pl = p.toLowerCase();
    return path === pl || path.startsWith(pl);
  });
}