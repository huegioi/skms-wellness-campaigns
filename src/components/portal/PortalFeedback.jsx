import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, ClipboardList } from 'lucide-react';
import ROIDashboard from './ROIDashboard';

export default function PortalFeedback({ client, proposals = [] }) {
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-5">
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="w-6 h-6 text-[#013f7c]" />
          <h2 className="text-xl font-bold text-[#013f7c]">Wellness ROI Dashboard</h2>
        </div>
        <p className="text-sm text-gray-400">
          Aggregate attendee feedback across all your programs — tracking presenteeism, absenteeism, and EQ impact.
        </p>
      </div>

      <ROIDashboard
        clientId={client?.id}
        clientCompany={client?.company}
        services={services}
      />
    </div>
  );
}