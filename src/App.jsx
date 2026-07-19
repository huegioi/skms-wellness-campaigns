import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import AddLead from './pages/AddLead';
import Assessments from './pages/Assessments';
import SpeakerPortalRedirect from './components/portal/SpeakerPortalRedirect';
import ReferralPortal from './pages/ReferralPortal';
import { Navigate } from 'react-router-dom';
import CampaignCalendar from './pages/CampaignCalendar';
import AttendeeForm from './pages/AttendeeForm';
import ClientReport from './pages/ClientReport';
import CohortAssessmentPage from './pages/CohortAssessment';
import Presenters from './pages/Presenters';
import PresenterPortal from './pages/PresenterPortal';
import QuickBuilder from './pages/QuickBuilder';
import Checkin from './pages/Checkin';
import MentalFitnessScore from './pages/MentalFitnessScore';
import MfsSurvey from './pages/MfsSurvey';
import MfsResults from './pages/MfsResults';
import Unsubscribe from './pages/Unsubscribe';
import Demo from './pages/Demo';
import MayaKnowledge from './pages/MayaKnowledge';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { isPublicPath } from '@/lib/publicPaths';
import { useGlobalAuthErrorHandler } from '@/lib/useGlobalAuthErrorHandler';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import SessionExpiredScreen from '@/components/SessionExpiredScreen';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const sessionExpired = useGlobalAuthErrorHandler();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const isPublicPage = isPublicPath();

  // Handle authentication errors (expired token, app-level rejects)
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'auth_required' && !isPublicPage) {
      navigateToLogin();
      return null;
    }
    // For public pages with an auth error, fall through to render routes
  }

  // No active session and not a public page → redirect to login immediately.
  // Never render the admin layout unauthenticated (fresh domain / no token).
  if (!isAuthenticated && !isPublicPage) {
    navigateToLogin();
    return null;
  }

  // Token expired mid-session — entity reads are 401ing. Show a clear
  // "Session expired" screen instead of silently empty-state UI.
  if (sessionExpired && !isPublicPage) {
    return <SessionExpiredScreen />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/AddLead" element={<LayoutWrapper currentPageName="AddLead"><AddLead /></LayoutWrapper>} />
      <Route path="/Assessments" element={<LayoutWrapper currentPageName="Assessments"><Assessments /></LayoutWrapper>} />
      <Route path="/ReferralPortal" element={<ReferralPortal />} />
      <Route path="/ReferralPartnerAdmin" element={<Navigate to="/Leads" replace />} />
      <Route path="/CampaignCalendar" element={<LayoutWrapper currentPageName="CampaignCalendar"><CampaignCalendar /></LayoutWrapper>} />
      <Route path="/AttendeeForm" element={<AttendeeForm />} />
      <Route path="/ClientReport" element={<ClientReport />} />
      <Route path="/CohortAssessment" element={<CohortAssessmentPage />} />
      <Route path="/SpeakerPortal" element={<SpeakerPortalRedirect />} />
      <Route path="/Presenters" element={<LayoutWrapper currentPageName="Presenters"><Presenters /></LayoutWrapper>} />
      <Route path="/PresenterPortal" element={<PresenterPortal />} />
      <Route path="/QuickBuilder" element={<QuickBuilder />} />
      <Route path="/Checkin" element={<Checkin />} />
      <Route path="/MentalFitnessScore" element={<MentalFitnessScore />} />
      <Route path="/MfsSurvey" element={<MfsSurvey />} />
      <Route path="/MfsResults" element={<MfsResults />} />
      <Route path="/Unsubscribe" element={<Unsubscribe />} />
      <Route path="/Demo" element={<LayoutWrapper currentPageName="Demo"><Demo /></LayoutWrapper>} />
      <Route path="/MayaKnowledge" element={<LayoutWrapper currentPageName="MayaKnowledge"><MayaKnowledge /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster closeButton position="bottom-right" />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App