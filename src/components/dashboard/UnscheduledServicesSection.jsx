import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useClientDeliveryStatus } from '@/hooks/useClientDeliveryStatus';

export default function UnscheduledServicesSection() {
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const snapshots = useClientDeliveryStatus(clients);

  const withUnscheduled = clients.filter(c => {
    const s = snapshots[c.id];
    return s?.unscheduledServices?.length > 0 && c.client_stage !== 'churned';
  });

  if (withUnscheduled.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl text-amber-800">
            <CalendarPlus className="w-6 h-6" />
            Services to Schedule
          </div>
          <Badge className="bg-amber-500 text-white">{withUnscheduled.length} client{withUnscheduled.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {withUnscheduled.map(client => {
            const s = snapshots[client.id];
            return (
              <div key={client.id} className="bg-white rounded-xl border border-amber-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{client.company || client.name}</p>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {s.unscheduledServices.length} service{s.unscheduledServices.length !== 1 ? 's' : ''} unscheduled
                  </p>
                </div>
                <Link to={`/SchedulingHub?clientId=${client.id}&proposalId=${s.acceptedProposalId || ''}`}>
                  <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#264d44] text-white hover:bg-[#1a3830] whitespace-nowrap">
                    Schedule
                  </button>
                </Link>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}