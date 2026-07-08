import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, BarChart3, Calendar, Package, Mail, Menu, X, ClipboardList, Landmark, Wand2, CalendarDays, ScanText, Sparkles } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', page: 'Home', icon: BarChart3 },
  { name: 'Partners', page: 'Leads', icon: Mail, altPages: ['ReferralPartnerAdmin'] },
  { name: 'Clients', page: 'Clients', icon: Users, altPages: ['ManageClientPortals', 'Proposals', 'EditProposal', 'EmailTemplateManager'] },
  { name: 'Services', page: 'ServiceCatalog', icon: Package },
  { name: 'Schedule', page: 'SchedulingHub', icon: Calendar },
  { name: 'Financials', page: 'Financials', icon: Landmark },
  { name: 'Feedback', page: 'FeedbackAnalytics', icon: ClipboardList },
  { name: 'Campaigns', page: 'CampaignCalendar', icon: CalendarDays },
  { name: 'Presenters', page: 'Presenters', icon: Users },
  { name: 'Quick Builder', page: 'QuickBuilder', icon: Sparkles },
];

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

const PUBLIC_PAGES = ['ViewProposal', 'MyPortal', 'ClientPortal', 'FeedbackForm', 'ReferralPortal'];

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Public pages — no chrome
  if (PUBLIC_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen bg-[#f4f0e9] flex overflow-hidden">

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

          {/* Quick Capture CTA — styled like Builder, forest green */}
          <Link
            to={createPageUrl('AddLead')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors mb-2 ${
              currentPageName === 'AddLead'
                ? 'bg-[#264d44] text-white border-[#264d44]'
                : 'text-[#264d44] border-[#264d44] hover:bg-[#264d44] hover:text-white'
            }`}
          >
            <ScanText className="w-4 h-4 shrink-0" />
            Quick Capture
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page || (item.altPages && item.altPages.includes(currentPageName));
            return (
              <Link
                key={item.page}
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

          {/* Quick Capture CTA — styled like Builder, forest green */}
          <Link
            to={createPageUrl('AddLead')}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors mb-2 ${
              currentPageName === 'AddLead'
                ? 'bg-[#264d44] text-white border-[#264d44]'
                : 'text-[#264d44] border-[#264d44] hover:bg-[#264d44] hover:text-white'
            }`}
          >
            <ScanText className="w-4 h-4 shrink-0" />
            Quick Capture
          </Link>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page || (item.altPages && item.altPages.includes(currentPageName));
            return (
              <Link
                key={item.page}
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
            );
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56 overflow-y-auto">
        <main className="flex-1 pb-16">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM BAR — outside scroll container, truly fixed ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-center justify-between px-4 shadow-md" style={{ height: 56 }}>
        <Link
          to={createPageUrl('Home')}
          className="flex items-center gap-2 touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-7 w-auto shrink-0" />
          <span className="font-bold text-[#013f7c] text-sm">SkillfulMeans Ops</span>
        </Link>
        <button
          onPointerDown={() => setMobileOpen(true)}
          className="flex items-center justify-center rounded-full bg-[#013f7c] text-white touch-manipulation"
          style={{ width: 44, height: 44, WebkitTapHighlightColor: 'transparent' }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
}