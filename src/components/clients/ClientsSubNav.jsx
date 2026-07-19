import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FolderOpen, Mail, Eye, ChevronLeft, ChevronRight, Brain } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const TABS = [
  { id: 'clients', label: 'Clients', icon: Users, page: 'Clients' },
  { id: 'assessments', label: 'Assessments', icon: Brain, page: 'Assessments', badge: true },
  { id: 'proposals', label: 'Proposals', icon: FolderOpen, page: 'Proposals' },
  { id: 'templates', label: 'Templates', icon: Mail, page: 'EmailTemplateManager' },
  { id: 'portals', label: 'Client Portals', icon: Eye, page: 'ManageClientPortals' },
];

export default function ClientsSubNav({ activePage }) {
  const navigate = useNavigate();
  const currentIndex = TABS.findIndex(t => t.page === activePage);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  const { data: mfsAssessments = [] } = useQuery({
    queryKey: ['mfs-assessments-count'],
    queryFn: () => base44.entities.MfsAssessment.list('-created_date', 200),
    staleTime: 60_000,
  });
  const mfsCount = mfsAssessments.length;

  const goLeft = () => {
    if (safeIndex > 0) navigate(createPageUrl(TABS[safeIndex - 1].page));
  };
  const goRight = () => {
    if (safeIndex < TABS.length - 1) navigate(createPageUrl(TABS[safeIndex + 1].page));
  };

  return (
    <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: '#013f7c' }}>Clients</h1>

        {/* Desktop tabs */}
        <div className="hidden md:flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activePage === tab.page;
            return (
              <Link
                key={tab.id}
                to={createPageUrl(tab.page)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                  isActive
                    ? 'border-[#264d44] text-[#264d44] bg-[#f4f0e9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && (
                  <span className="ml-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
                    {mfsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Mobile: arrow navigation */}
        <div className="md:hidden flex items-center gap-3 pb-3">
          <button
            onClick={goLeft}
            disabled={safeIndex === 0}
            className="p-2 rounded-full bg-blue-100 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-200 transition-all flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            {(() => {
              const Icon = TABS[safeIndex].icon;
              return (
                <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#264d44] text-white">
                  <Icon className="w-3.5 h-3.5" />
                  {TABS[safeIndex].label}
                  {TABS[safeIndex].badge && (
                    <span className="ml-0.5 text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">
                      {mfsCount}
                    </span>
                  )}
                </span>
              );
            })()}
          </div>
          <button
            onClick={goRight}
            disabled={safeIndex === TABS.length - 1}
            className="p-2 rounded-full bg-blue-100 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-200 transition-all flex-shrink-0"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}