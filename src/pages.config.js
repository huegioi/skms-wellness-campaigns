import CurriculumDesigner from './pages/CurriculumDesigner';
import Clients from './pages/Clients';
import Proposals from './pages/Proposals';
import EditProposal from './pages/EditProposal';
import Analytics from './pages/Analytics';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CurriculumDesigner": CurriculumDesigner,
    "Clients": Clients,
    "Proposals": Proposals,
    "EditProposal": EditProposal,
    "Analytics": Analytics,
}

export const pagesConfig = {
    mainPage: "CurriculumDesigner",
    Pages: PAGES,
    Layout: __Layout,
};