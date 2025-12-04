import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FileText, FolderOpen, BarChart3, Calendar } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('CurriculumDesigner')} className="flex items-center gap-2">
            <span className="font-bold text-lg" style={{ color: '#013f7c' }}>SKMS Wellness Campaigns</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-4">
            <Link 
              to={createPageUrl('CurriculumDesigner')} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'CurriculumDesigner' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Builder</span>
            </Link>
            <Link 
              to={createPageUrl('Proposals')} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'Proposals' || currentPageName === 'EditProposal' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Proposals</span>
            </Link>
            <Link 
              to={createPageUrl('Clients')} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'Clients' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Clients</span>
            </Link>
            <Link 
              to={createPageUrl('Analytics')} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'Analytics' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
            <Link 
              to={createPageUrl('Calendar')} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'Calendar' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar</span>
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