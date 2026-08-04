import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import ROIDashboard from './ROIDashboard';

export default function PortalFeedback({ client, proposals = [], services = [] }) {
  const acceptedProposal = proposals.find(p => p.status === 'accepted');

  // Filter the services already fetched by getClientPortalData to those tied
  // to this client — via purchased_services IDs or accepted proposal selections.
  // No client-side Service read (that returns empty under RLS for portal visitors).
  const clientServices = useMemo(() => {
    const serviceIdSet = new Set();

    (client?.purchased_services || []).forEach(id => serviceIdSet.add(id));

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
    return services.filter(s => serviceIdSet.has(s.id));
  }, [client?.purchased_services, proposals, services]);

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
        clientToken={client?.portal_token}
        showReportButton={!!client?.portal_token}
        onGenerateReport={() => window.open(`${window.location.origin}/ClientReport?client_id=${client.id}&token=${client.portal_token}`, '_blank')}
      />
    </div>
  );
}