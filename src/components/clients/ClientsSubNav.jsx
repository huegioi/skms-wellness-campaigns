import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, FolderOpen, Mail, Eye } from 'lucide-react';

const TABS = [
  { id: 'clients', label: 'Clients', icon: Users, page: 'Clients' },
  { id: 'proposals', label: 'Proposals', icon: FolderOpen, page: 'Proposals' },
  { id: 'templates', label: 'Templates', icon: Mail, page: 'EmailTemplateManager' },
  { id: 'portals', label: 'Client Portals', icon: Eye, page: 'ManageClientPortals' },
];

export default function ClientsSubNav({ activePage }) {
  return (
    <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: '#013f7c' }}>Clients</h1>
        <div className="flex gap-1">
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
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}