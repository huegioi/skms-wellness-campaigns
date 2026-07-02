import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, List, LayoutGrid } from 'lucide-react';
import ResourceCard from './ResourceCard';

const typeOrder = ['video', 'audio', 'recording', 'presentation', 'handout', 'guide', 'link', 'other'];

const typeLabels = {
  video: 'Videos',
  audio: 'Audio',
  recording: 'Recordings',
  presentation: 'Presentations',
  handout: 'Handouts',
  guide: 'Guides',
  link: 'Links',
  other: 'Other Resources',
};

export default function ClientResources({ client, proposals = [], services = [] }) {
  const [groupBy, setGroupBy] = useState('service');

  const liveResources = useMemo(() => {
    const acceptedProposals = proposals.filter(p => p.status === 'accepted');

    // Collect service IDs from accepted proposal selections
    const serviceIds = new Set();
    for (const p of acceptedProposals) {
      const sel = p.selections || {};
      for (const ids of [sel.workshops, sel.challengePrograms, sel.leadership, sel.movementClasses, sel.wellnessBoxes]) {
        (ids || []).forEach(id => serviceIds.add(id));
      }
    }

    // Build live resources from the current state of each service
    const resources = [];
    for (const service of services) {
      if (!serviceIds.has(service.id)) continue;
      for (const r of (service.resources || [])) {
        resources.push({
          title: r.title,
          file_url: r.file_url,
          resource_type: r.resource_type,
          description: r.description,
          uploaded_date: r.uploaded_date,
          session_name: service.name,
          source_service_id: service.id,
        });
      }
    }

    // Include legacy manually-added session_resources (no source_service_id)
    const legacy = (client?.session_resources || []).filter(r => !r.source_service_id);
    for (const r of legacy) {
      resources.push({
        title: r.title,
        file_url: r.url,
        resource_type: r.resource_type,
        description: r.description,
        session_name: r.session_name || 'General Resources',
        added_date: r.added_date,
      });
    }

    return resources;
  }, [proposals, services, client]);

  if (liveResources.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Resources Yet</h3>
        <p className="text-gray-500">Session recordings, presentations, and handouts will appear here once they've been shared with you.</p>
      </div>
    );
  }

  // Group resources
  const grouped = liveResources.reduce((acc, r) => {
    const key = groupBy === 'service'
      ? (r.session_name || 'General Resources')
      : (r.resource_type || 'other');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groupKeys = groupBy === 'service'
    ? Object.keys(grouped).sort()
    : typeOrder.filter(k => grouped[k]);

  const getGroupLabel = (key) => {
    if (groupBy === 'type') return typeLabels[key] || 'Other Resources';
    return key;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-2xl text-brand-navy">Session Resources</CardTitle>
              <p className="text-gray-500 text-sm mt-1">
                Access your session recordings, presentations, and handout materials below.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={groupBy === 'service' ? 'default' : 'outline'}
                className={groupBy === 'service' ? 'bg-brand-green hover:bg-[#1a3830]' : ''}
                onClick={() => setGroupBy('service')}
              >
                <List className="w-4 h-4 mr-1" /> By Service
              </Button>
              <Button
                size="sm"
                variant={groupBy === 'type' ? 'default' : 'outline'}
                className={groupBy === 'type' ? 'bg-brand-green hover:bg-[#1a3830]' : ''}
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

        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-brand-green">
                <FolderOpen className="w-5 h-5 text-brand-green" />
                {getGroupLabel(key)}
                <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((resource, i) => (
                  <ResourceCard key={i} resource={resource} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}