import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FileText, FolderOpen, BarChart3, Calendar, Package, Mail, UserCircle } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  // Public pages - no navigation
  if (currentPageName === 'ViewProposal' || currentPageName === 'MyPortal') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('CurriculumDesigner')} className="flex items-center gap-1 sm:gap-2">
            <span className="font-bold text-sm sm:text-base lg:text-lg" style={{ color: '#013f7c' }}>SKMS Wellness</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-wrap">
            <Link 
              to={createPageUrl('CurriculumDesigner')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'CurriculumDesigner' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Builder</span>
            </Link>
            <Link 
              to={createPageUrl('Proposals')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'Proposals' || currentPageName === 'EditProposal' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FolderOpen className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Proposals</span>
            </Link>
            <Link 
              to={createPageUrl('Clients')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'Clients' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Clients</span>
            </Link>
            <Link 
              to={createPageUrl('Analytics')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'Analytics' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Analytics</span>
            </Link>
            <Link 
              to={createPageUrl('Calendar')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'Calendar' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden lg:inline">Calendar</span>
            </Link>
            <Link 
              to={createPageUrl('ServiceCatalog')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'ServiceCatalog' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Package className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden lg:inline">Services</span>
            </Link>
            <Link 
              to={createPageUrl('EmailTemplateManager')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'EmailTemplateManager' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden lg:inline">Templates</span>
            </Link>

            <Link 
              to={createPageUrl('SchedulingHub')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'SchedulingHub' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden lg:inline">Schedule</span>
            </Link>

            <Link 
              to={createPageUrl('Invoices')} 
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPageName === 'Invoices' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden lg:inline">Invoices</span>
            </Link>
            </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        {children}
      </main>
    </div>
  );
}