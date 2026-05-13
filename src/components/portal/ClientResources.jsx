import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, FileText, ExternalLink, FolderOpen, BookOpen, Presentation, File, LayoutGrid, List } from 'lucide-react';

const resourceConfig = {
  recording: { label: 'Recording', icon: Video, color: 'bg-red-100 text-red-700 border-red-200', iconColor: 'text-red-500' },
  presentation: { label: 'Presentation', icon: Presentation, color: 'bg-blue-100 text-blue-700 border-blue-200', iconColor: 'text-blue-500' },
  handout: { label: 'Handout', icon: FileText, color: 'bg-green-100 text-green-700 border-green-200', iconColor: 'text-green-500' },
  guide: { label: 'Guide', icon: BookOpen, color: 'bg-purple-100 text-purple-700 border-purple-200', iconColor: 'text-purple-500' },
  other: { label: 'Resource', icon: FolderOpen, color: 'bg-gray-100 text-gray-700 border-gray-200', iconColor: 'text-gray-500' },
};

function ResourceRow({ resource }) {
  const type = resource.resource_type || 'other';
  const config = resourceConfig[type] || resourceConfig.other;
  const Icon = config.icon;

  return (
    <a
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
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
            {resource.added_date && (
              <span className="text-xs text-gray-400">Added {new Date(resource.added_date).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#264d44] flex-shrink-0 ml-3" />
    </a>
  );
}

export default function ClientResources({ client }) {
  const [groupBy, setGroupBy] = useState('service'); // 'service' | 'type'
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

  // Group by service (session_name) or by type
  const grouped = resources.reduce((acc, r) => {
    const key = groupBy === 'service'
      ? (r.session_name || 'General Resources')
      : (r.resource_type || 'other');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groupKeys = groupBy === 'service'
    ? Object.keys(grouped).sort()
    : ['recording', 'presentation', 'handout', 'guide', 'other'].filter(k => grouped[k]);

  const getGroupLabel = (key) => {
    if (groupBy === 'type') {
      return (resourceConfig[key] || resourceConfig.other).label + 's';
    }
    return key;
  };

  const getGroupIcon = (key) => {
    if (groupBy === 'type') {
      return (resourceConfig[key] || resourceConfig.other).icon;
    }
    return FolderOpen;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-2xl" style={{ color: '#013f7c' }}>Session Resources</CardTitle>
              <p className="text-gray-500 text-sm mt-1">
                Access your session recordings, presentations, and handout materials below.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={groupBy === 'service' ? 'default' : 'outline'}
                className={groupBy === 'service' ? 'bg-[#264d44] hover:bg-[#1a3830]' : ''}
                onClick={() => setGroupBy('service')}
              >
                <List className="w-4 h-4 mr-1" /> By Service
              </Button>
              <Button
                size="sm"
                variant={groupBy === 'type' ? 'default' : 'outline'}
                className={groupBy === 'type' ? 'bg-[#264d44] hover:bg-[#1a3830]' : ''}
                onClick={() => setGroupBy('type')}
              >
                <LayoutGrid className="w-4 h-4 mr-1" /> By Type
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {groupKeys.map(key => {
        const items = grouped[key];
        if (!items?.length) return null;
        const Icon = getGroupIcon(key);

        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2" style={{ color: '#264d44' }}>
                <Icon className="w-5 h-5 text-[#264d44]" />
                {getGroupLabel(key)}
                <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((resource, i) => (
                  <ResourceRow key={i} resource={resource} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}