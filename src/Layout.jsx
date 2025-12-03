import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FileText } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('CurriculumDesigner')} className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/abfb649ad_SkillfulMeansWebsiteHero.png" 
              alt="SkillfulMeans" 
              className="h-8"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              to={createPageUrl('CurriculumDesigner')} 
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === 'CurriculumDesigner' ? 'bg-[#264d44] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Proposal Builder</span>
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