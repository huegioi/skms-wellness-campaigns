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
];

export function isPublicPath(pathname) {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (!path) return false;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));
}