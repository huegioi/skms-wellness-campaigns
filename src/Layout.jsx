import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FileText, FolderOpen, BarChart3, Calendar, Package, Mail, Menu, X, Gift } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Public pages - no navigation
  if (currentPageName === 'ViewProposal' || currentPageName === 'MyPortal') {
    return <>{children}</>;
  }

  const navItems = [
    { name: 'Builder', page: 'CurriculumDesigner', icon: FileText },
    { name: 'Proposals', page: 'Proposals', icon: FolderOpen, altPage: 'EditProposal' },
    { name: 'Clients', page: 'Clients', icon: Users },
    { name: 'Analytics', page: 'Analytics', icon: BarChart3 },
    { name: 'Services', page: 'ServiceCatalog', icon: Package },
    { name: 'Templates', page: 'EmailTemplateManager', icon: Mail },
    { name: 'Schedule', page: 'SchedulingHub', icon: Calendar },
    { name: 'Invoices', page: 'Invoices', icon: FileText },
    { name: 'Wellness Boxes', page: 'WellnessBoxes', icon: Gift }
  ];

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={createPageUrl('CurriculumDesigner')} className="flex-shrink-0">
              <span className="font-bold text-base sm:text-lg md:text-xl" style={{ color: '#013f7c' }}>
                SKMS Wellness
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page || (item.altPage && currentPageName === item.altPage);
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-white">
            <div className="px-4 py-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page || (item.altPage && currentPageName === item.altPage);
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main className="pb-6">
        {children}
      </main>
    </div>
  );
}