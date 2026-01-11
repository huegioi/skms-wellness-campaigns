import Analytics from './pages/Analytics';
import ClientPortal from './pages/ClientPortal';
import Clients from './pages/Clients';
import CurriculumDesigner from './pages/CurriculumDesigner';
import EditProposal from './pages/EditProposal';
import EmailTemplateManager from './pages/EmailTemplateManager';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import MyPortal from './pages/MyPortal';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Proposals from './pages/Proposals';
import QuickBooksOAuth from './pages/QuickBooksOAuth';
import SchedulingHub from './pages/SchedulingHub';
import ServiceCatalog from './pages/ServiceCatalog';
import UserAgreement from './pages/UserAgreement';
import ViewProposal from './pages/ViewProposal';
import WellnessBoxes from './pages/WellnessBoxes';
import Dashboard from './pages/Dashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "ClientPortal": ClientPortal,
    "Clients": Clients,
    "CurriculumDesigner": CurriculumDesigner,
    "EditProposal": EditProposal,
    "EmailTemplateManager": EmailTemplateManager,
    "Home": Home,
    "Invoices": Invoices,
    "MyPortal": MyPortal,
    "PrivacyPolicy": PrivacyPolicy,
    "Proposals": Proposals,
    "QuickBooksOAuth": QuickBooksOAuth,
    "SchedulingHub": SchedulingHub,
    "ServiceCatalog": ServiceCatalog,
    "UserAgreement": UserAgreement,
    "ViewProposal": ViewProposal,
    "WellnessBoxes": WellnessBoxes,
    "Dashboard": Dashboard,
}

export const pagesConfig = {
    mainPage: "CurriculumDesigner",
    Pages: PAGES,
    Layout: __Layout,
};