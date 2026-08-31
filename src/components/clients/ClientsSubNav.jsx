import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FolderOpen, Mail, Eye, Brain } from 'lucide-react';
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
  const { data: mfsAssessments = [] } = useQuery({
    queryKey: ['mfs-assessments-count'],
    queryFn: () => base44.entities.MfsAssessment.list('-created_date', 200),
    staleTime: 60_000,
  });
  const mfsCount = mfsAssessments.length;

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

        {/* Mobile: scrolling chip row — every destination stays visible and one tap away */}
        <div className="md:hidden -mx-4 px-4 pb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 w-max">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activePage === tab.page;
              return (
                <Link
                  key={tab.id}
                  to={createPageUrl(tab.page)}
                  className={`flex items-center gap-1.5 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'bg-[#264d44] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{ minHeight: 44 }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {mfsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}