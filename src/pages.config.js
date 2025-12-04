import CurriculumDesigner from './pages/CurriculumDesigner';
import Clients from './pages/Clients';
import Proposals from './pages/Proposals';
import EditProposal from './pages/EditProposal';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import ServiceCatalog from './pages/ServiceCatalog';
import ClientPortal from './pages/ClientPortal';
import EmailTemplateManager from './pages/EmailTemplateManager';
import MyPortal from './pages/MyPortal';
import ViewProposal from './pages/ViewProposal';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CurriculumDesigner": CurriculumDesigner,
    "Clients": Clients,
    "Proposals": Proposals,
    "EditProposal": EditProposal,
    "Analytics": Analytics,
    "Calendar": Calendar,
    "ServiceCatalog": ServiceCatalog,
    "ClientPortal": ClientPortal,
    "EmailTemplateManager": EmailTemplateManager,
    "MyPortal": MyPortal,
    "ViewProposal": ViewProposal,
}

export const pagesConfig = {
    mainPage: "CurriculumDesigner",
    Pages: PAGES,
    Layout: __Layout,
};