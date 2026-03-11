/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Analytics from './pages/Analytics';
import ClientPortal from './pages/ClientPortal';
import Clients from './pages/Clients';
import CurriculumDesigner from './pages/CurriculumDesigner';
import Dashboard from './pages/Dashboard';
import EditProposal from './pages/EditProposal';
import EmailTemplateManager from './pages/EmailTemplateManager';
import FeedbackAnalytics from './pages/FeedbackAnalytics';
import FeedbackForm from './pages/FeedbackForm';
import Financials from './pages/Financials';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import ManageClientPortals from './pages/ManageClientPortals';
import MyPortal from './pages/MyPortal';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Proposals from './pages/Proposals';
import QuickBooksOAuth from './pages/QuickBooksOAuth';
import SchedulingHub from './pages/SchedulingHub';
import ServiceCatalog from './pages/ServiceCatalog';
import UserAgreement from './pages/UserAgreement';
import ViewProposal from './pages/ViewProposal';
import WellnessBoxes from './pages/WellnessBoxes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "ClientPortal": ClientPortal,
    "Clients": Clients,
    "CurriculumDesigner": CurriculumDesigner,
    "Dashboard": Dashboard,
    "EditProposal": EditProposal,
    "EmailTemplateManager": EmailTemplateManager,
    "FeedbackAnalytics": FeedbackAnalytics,
    "FeedbackForm": FeedbackForm,
    "Financials": Financials,
    "Home": Home,
    "Invoices": Invoices,
    "ManageClientPortals": ManageClientPortals,
    "MyPortal": MyPortal,
    "PrivacyPolicy": PrivacyPolicy,
    "Proposals": Proposals,
    "QuickBooksOAuth": QuickBooksOAuth,
    "SchedulingHub": SchedulingHub,
    "ServiceCatalog": ServiceCatalog,
    "UserAgreement": UserAgreement,
    "ViewProposal": ViewProposal,
    "WellnessBoxes": WellnessBoxes,
}

export const pagesConfig = {
    mainPage: "CurriculumDesigner",
    Pages: PAGES,
    Layout: __Layout,
};