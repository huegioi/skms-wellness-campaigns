import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useRateCard } from '@/lib/useRateCard';
import { Users, BarChart3, Calendar, Package, Mail, Menu, X, ClipboardList, Landmark, Wand2, CalendarDays, ScanText, Wrench, FlaskConical, ExternalLink } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', page: 'Home', icon: BarChart3 },
  { name: 'Partners', page: 'Leads', icon: Mail },
  { name: 'Clients', page: 'Clients', icon: Users, altPages: ['ManageClientPortals', 'Proposals', 'EditProposal', 'EmailTemplateManager'] },
  { name: 'Services', page: 'ServiceCatalog', icon: Package, altPages: ['RateCard'] },
  { name: 'Schedule', page: 'SchedulingHub', icon: Calendar },
  { name: 'Financials', page: 'Financials', icon: Landmark },
  { name: 'Analytics', page: 'FeedbackAnalytics', icon: ClipboardList, altPages: ['RoiTestBed', 'CompanyStats'] },
  { name: 'Campaigns', page: 'CampaignCalendar', icon: CalendarDays },
  { name: 'Presenters', page: 'Presenters', icon: Users },
  // Occasional-use tools live behind one door now (see pages/AdminTools.jsx).
  // altPages keeps this item lit while you are on any of them, since none of
  // those pages has a menu item of its own any more.
  {
    name: 'Admin Tools',
    page: 'AdminTools',
    icon: Wrench,
    divider: true,
    altPages: ['AddLead', 'ClaimsInsight', 'MayaKnowledge', 'Demo'],
  },
];

// Mobile tab bar — the four destinations that are genuinely phone jobs.
// Everything else stays one tap away behind "More", which opens the same drawer.
const mobileTabs = [
  { name: 'Dashboard', page: 'Home', icon: BarChart3 },
  { name: 'Clients', page: 'Clients', icon: Users, altPages: ['ManageClientPortals', 'Proposals', 'EditProposal', 'EmailTemplateManager', 'Assessments'] },
  { name: 'Partners', page: 'Leads', icon: Mail, altPages: ['ReferralPartnerAdmin'] },
  { name: 'Schedule', page: 'SchedulingHub', icon: Calendar },
];

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

const PUBLIC_PAGES = ['ViewProposal', 'MyPortal', 'ClientPortal', 'FeedbackForm', 'ReferralPortal', 'Checkin', 'MentalFitnessScore', 'MfsSurvey', 'MfsResults', 'Unsubscribe'];

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useRateCard();   // apply saved rate card overrides before anything quotes a price
  const [demoActive, setDemoActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') return;
        const records = await base44.entities.ReferralPartner.filter({ is_demo: true }, '-created_date', 1);
        if (!cancelled) setDemoActive(records.length > 0);
      } catch {
        if (!cancelled) setDemoActive(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Public pages — no chrome
  if (PUBLIC_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  // "More" lights up whenever the current page isn't one of the four mobile tabs
  const moreActive = !mobileTabs.some(
    (t) => currentPageName === t.page || (t.altPages && t.altPages.includes(currentPageName))
  );

  return (
    <div className="h-[100dvh] bg-[#f4f0e9] flex overflow-hidden">

      {/* ── SIDEBAR (desktop) ── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-40 shadow-sm">
        {/* Logo */}
        <Link
          to={createPageUrl('Home')}
          className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100"
        >
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-8 w-auto shrink-0" />
          <span className="font-bold text-[#013f7c] text-sm leading-tight">SkillfulMeans<br/>Operations</span>
        </Link>

        {demoActive && (
          <Link to={createPageUrl('Demo')} className="mx-3 mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors">
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            DEMO DATA ACTIVE
          </Link>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Builder CTA — top of nav */}
          <Link
            to={createPageUrl('CurriculumDesigner')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors mb-2 ${
              currentPageName === 'CurriculumDesigner'
                ? 'bg-[#013f7c] text-white border-[#013f7c]'
                : 'text-[#013f7c] border-[#013f7c] hover:bg-[#013f7c] hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4 shrink-0" />
            Builder
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page || (item.altPages && item.altPages.includes(currentPageName));
            if (item.external) {
              return (
                <a
                  key={item.page}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.name}
                  <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                </a>
              );
            }
            return (
              <React.Fragment key={item.page}>
                {item.divider && <div className="my-2 border-t border-gray-100" />}
                <Link
                  to={createPageUrl(item.page)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#264d44] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.name}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── MOBILE DRAWER ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl flex flex-col transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Link
            to={createPageUrl('Home')}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5"
          >
            <img src={LOGO_URL} alt="SkillfulMeans" className="h-7 w-auto shrink-0" />
            <span className="font-bold text-[#013f7c] text-base">SkillfulMeans Ops</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {demoActive && (
          <Link to={createPageUrl('Demo')} onClick={() => setMobileOpen(false)} className="mx-3 mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors">
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            DEMO DATA ACTIVE
          </Link>
        )}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Builder CTA — top of nav */}
          <Link
            to={createPageUrl('CurriculumDesigner')}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors mb-2 ${
              currentPageName === 'CurriculumDesigner'
                ? 'bg-[#013f7c] text-white border-[#013f7c]'
                : 'text-[#013f7c] border-[#013f7c] hover:bg-[#013f7c] hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4 shrink-0" />
            Builder
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page || (item.altPages && item.altPages.includes(currentPageName));
            if (item.external) {
              return (
                <a
                  key={item.page}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.name}
                  <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                </a>
              );
            }
            return (
              <React.Fragment key={item.page}>
                {item.divider && <div className="my-2 border-t border-gray-100" />}
                <Link
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#264d44] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.name}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56 overflow-y-auto">
        <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── MOBILE QUICK CAPTURE — floating, thumb-reachable, mobile only ── */}
      <Link
        to={createPageUrl('AddLead')}
        aria-label="Quick Capture"
        className="lg:hidden fixed right-4 z-40 flex items-center justify-center rounded-full bg-[#264d44] text-white shadow-lg active:scale-95 transition-transform touch-manipulation"
        style={{ width: 56, height: 56, bottom: 'calc(72px + env(safe-area-inset-bottom))', WebkitTapHighlightColor: 'transparent' }}
      >
        <ScanText className="w-6 h-6" />
      </Link>

      {/* ── MOBILE TAB BAR — outside scroll container, truly fixed, below the drawer ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex shadow-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          const isActive = currentPageName === item.page || (item.altPages && item.altPages.includes(currentPageName));
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 touch-manipulation ${isActive ? 'text-[#264d44]' : 'text-gray-400'}`}
              style={{ minHeight: 56, WebkitTapHighlightColor: 'transparent' }}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
            </Link>
          );
        })}
        <button
          onPointerDown={() => setMobileOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 touch-manipulation ${moreActive ? 'text-[#264d44]' : 'text-gray-400'}`}
          style={{ minHeight: 56, WebkitTapHighlightColor: 'transparent' }}
          aria-label="More"
        >
          <Menu className="w-5 h-5" strokeWidth={moreActive ? 2.5 : 2} />
          <span className={`text-[10px] leading-none ${moreActive ? 'font-bold' : 'font-medium'}`}>More</span>
        </button>
      </nav>

    </div>
  );
}