import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Presentation, FileText, ExternalLink, FolderOpen } from 'lucide-react';

const resourceConfig = {
  recording: { label: 'Recording', icon: Video, color: 'bg-red-100 text-red-700 border-red-200', iconColor: 'text-red-500' },
  presentation: { label: 'Presentation', icon: Presentation, color: 'bg-blue-100 text-blue-700 border-blue-200', iconColor: 'text-blue-500' },
  handout: { label: 'Handout', icon: FileText, color: 'bg-green-100 text-green-700 border-green-200', iconColor: 'text-green-500' },
  other: { label: 'Resource', icon: FolderOpen, color: 'bg-gray-100 text-gray-700 border-gray-200', iconColor: 'text-gray-500' }
};

export default function ClientResources({ client }) {
  const resources = client?.session_resources || [];

  if (resources.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Resources Yet</h3>
        <p className="text-gray-500">Session recordings, presentations, and handouts will appear here once they've been shared with you.</p>
      </div>
    );
  }

  // Group by resource_type
  const grouped = resources.reduce((acc, r) => {
    const type = r.resource_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {});

  const typeOrder = ['recording', 'presentation', 'handout', 'other'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl" style={{ color: '#013f7c' }}>Session Resources</CardTitle>
          <p className="text-gray-500 text-sm">Access your session recordings, presentation slides, and handout materials below.</p>
        </CardHeader>
      </Card>

      {typeOrder.map(type => {
        const items = grouped[type];
        if (!items?.length) return null;
        const config = resourceConfig[type];
        const Icon = config.icon;

        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2" style={{ color: '#264d44' }}>
                <Icon className={`w-5 h-5 ${config.iconColor}`} />
                {config.label}s
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((resource, i) => (
                  <a
                    key={i}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:border-[#264d44] hover:bg-[#264d4408] transition-all group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 group-hover:text-[#264d44] truncate">{resource.title}</p>
                        {resource.session_name && (
                          <p className="text-xs text-gray-500 mt-0.5">{resource.session_name}</p>
                        )}
                        {resource.added_date && (
                          <p className="text-xs text-gray-400 mt-0.5">Added {new Date(resource.added_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#264d44] flex-shrink-0 ml-3" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}