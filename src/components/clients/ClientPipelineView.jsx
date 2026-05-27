import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO } from 'date-fns';

const STAGES = [
  { key: 'onboarding',      label: 'Onboarding',      desc: 'New clients getting set up',              headerClass: 'bg-blue-50 border-blue-200',    textClass: 'text-blue-700' },
  { key: 'active',          label: 'Active',           desc: 'Programs running, relationship healthy',  headerClass: 'bg-green-50 border-green-200',  textClass: 'text-green-700' },
  { key: 'renewal_window',  label: 'Renewal Window',   desc: 'Renewal coming within 90 days',           headerClass: 'bg-amber-50 border-amber-300',  textClass: 'text-amber-700' },
  { key: 'at_risk',         label: 'At Risk',          desc: 'No contact in 60+ days',                  headerClass: 'bg-red-50 border-red-300',      textClass: 'text-red-700' },
  { key: 'expanded',        label: 'Expanded',         desc: 'Added new services',                      headerClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' },
  { key: 'churned',         label: 'Churned',          desc: 'Lost client',                             headerClass: 'bg-gray-100 border-gray-300',   textClass: 'text-gray-500' },
  { key: '__none__',        label: 'No Stage',         desc: 'Clients with no stage set yet',           headerClass: 'bg-slate-50 border-slate-200',  textClass: 'text-slate-500' },
];

function daysAgo(dateStr) {
  if (!dateStr) return null;
  try {
    const d = typeof dateStr === 'string' && dateStr.length <= 10
      ? parseISO(dateStr)
      : new Date(dateStr);
    return differenceInDays(new Date(), d);
  } catch { return null; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch { return null; }
}

function RenewalBadge({ dateStr }) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return <span className="text-xs font-medium text-red-600">Expired</span>;
  if (days <= 30) return <span className="text-xs font-medium text-red-600">Renews in {days}d</span>;
  if (days <= 90) return <span className="text-xs font-medium text-amber-600">Renews in {days}d</span>;
  return <span className="text-xs text-gray-400">Renews in {days}d</span>;
}

function ClientCard({ client, onStageChange, onClick }) {
  const ago = daysAgo(client.last_contacted_date || client.last_contacted);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Name + Company */}
      <div className="mb-1">
        <p className="font-semibold text-[#264d44] text-sm leading-tight">{client.company || client.name}</p>
        {client.company && <p className="text-xs text-gray-500">{client.name}</p>}
      </div>

      {/* Owner */}
      {client.owner && (
        <p className="text-xs text-gray-500 mb-1.5">👤 {client.owner}</p>
      )}

      {/* Last contacted */}
      {ago !== null ? (
        <p className={`text-xs mb-1 ${ago > 60 ? 'text-red-500 font-medium' : ago > 30 ? 'text-amber-600' : 'text-gray-500'}`}>
          Last contact: {ago === 0 ? 'today' : `${ago}d ago`}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-1">No contact recorded</p>
      )}

      {/* Renewal */}
      {client.renewal_date && (
        <div className="mb-1.5">
          <RenewalBadge dateStr={client.renewal_date} />
        </div>
      )}

      {/* Invoice + Services */}
      <div className="flex items-center gap-3 mb-2 text-xs text-gray-600">
        {(client.total_invoice_value || 0) > 0 && (
          <span className="text-green-700 font-medium">${(client.total_invoice_value).toLocaleString()}</span>
        )}
        {(client.purchased_services?.length || 0) > 0 && (
          <span>{client.purchased_services.length} service{client.purchased_services.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Stage dropdown — stop propagation so clicking it doesn't open client detail */}
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          value={client.client_stage || '__none__'}
          onValueChange={(val) => onStageChange(client.id, val === '__none__' ? null : val)}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue placeholder="Set stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="renewal_window">Renewal Window</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="expanded">Expanded</SelectItem>
            <SelectItem value="churned">Churned</SelectItem>
            <SelectItem value="__none__">No Stage</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function ClientPipelineView({ clients, ownerFilter, onClientClick }) {
  const queryClient = useQueryClient();

  const handleStageChange = async (clientId, newStage) => {
    await base44.entities.Client.update(clientId, { client_stage: newStage });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const filtered = ownerFilter && ownerFilter !== 'all'
    ? clients.filter(c => c.owner === ownerFilter)
    : clients;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {STAGES.map((stage) => {
          const stageClients = filtered.filter(c =>
            stage.key === '__none__'
              ? !c.client_stage
              : c.client_stage === stage.key
          );

          return (
            <div key={stage.key} className="w-56 flex-shrink-0">
              {/* Column header */}
              <div className={`rounded-t-lg border px-3 py-2 mb-2 ${stage.headerClass}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm ${stage.textClass}`}>{stage.label}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.textClass}`}>
                    {stageClients.length}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stage.desc}</p>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stageClients.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                    No clients
                  </div>
                ) : (
                  stageClients.map(client => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      onStageChange={handleStageChange}
                      onClick={() => onClientClick(client)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}