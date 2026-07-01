import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, ClipboardList } from 'lucide-react';
import ROIDashboard from './ROIDashboard';

export default function PortalFeedback({ client, proposals = [] }) {
  const acceptedProposal = proposals.find(p => p.status === 'accepted');
  // Fetch only services tied to this client — via purchased_services IDs or proposal selections
  const { data: clientServices = [] } = useQuery({
    queryKey: ['client-services', client?.id],
    queryFn: async () => {
      // Collect all service IDs associated with this client
      const serviceIdSet = new Set();

      // 1. From client.purchased_services array
      (client?.purchased_services || []).forEach(id => serviceIdSet.add(id));

      // 2. From accepted proposal selections — values are arrays of service IDs per category
      const SERVICE_ARRAY_KEYS = ['workshops', 'challengePrograms', 'leadership', 'movementClasses'];
      proposals
        .filter(p => p.status === 'accepted')
        .forEach(p => {
          if (!p.selections || typeof p.selections !== 'object') return;
          SERVICE_ARRAY_KEYS.forEach(key => {
            const arr = p.selections[key];
            if (Array.isArray(arr)) arr.forEach(id => id && serviceIdSet.add(id));
          });
        });

      if (serviceIdSet.size === 0) return [];

      // Fetch only those specific services
      const all = await base44.entities.Service.list('sort_order');
      return all.filter(s => serviceIdSet.has(s.id));
    },
    enabled: !!client?.id
  });

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="w-6 h-6 text-blue-700" />
          <h2 className="text-xl font-bold text-blue-900">Wellness ROI Dashboard</h2>
        </div>
        <p className="text-sm text-blue-800/70">
          Aggregate attendee feedback across all your programs — tracking presenteeism, absenteeism, and EQ impact.
        </p>
      </div>

      <ROIDashboard
        clientId={client?.id}
        clientCompany={client?.company}
        services={clientServices}
        acceptedProposalId={acceptedProposal?.id}
        showReportButton={!!client?.portal_token}
        onGenerateReport={() => window.open(`${window.location.origin}/ClientReport?client_id=${client.id}&token=${client.portal_token}`, '_blank')}
      />
    </div>
  );
}