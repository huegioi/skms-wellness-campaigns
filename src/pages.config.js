import CurriculumDesigner from './pages/CurriculumDesigner';
import Clients from './pages/Clients';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CurriculumDesigner": CurriculumDesigner,
    "Clients": Clients,
}

export const pagesConfig = {
    mainPage: "CurriculumDesigner",
    Pages: PAGES,
    Layout: __Layout,
};