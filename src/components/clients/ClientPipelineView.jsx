import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO } from 'date-fns';
import StagePlaybookDialog from './StagePlaybookDialog';

const STAGES = [
  { key: 'new_client_setup',   label: 'New Client Setup',    desc: 'Completing onboarding tasks, scheduling first programs',             headerClass: 'bg-blue-50 border-blue-200',    textClass: 'text-blue-700' },
  { key: 'program_delivery',   label: 'Program Delivery',    desc: 'Actively delivering workshops, challenges, boxes',                   headerClass: 'bg-green-50 border-green-200',  textClass: 'text-green-700' },
  { key: 'followup_feedback',  label: 'Follow-up & Feedback',desc: 'Collecting surveys, building ROI reports, sending closing emails',   headerClass: 'bg-teal-50 border-teal-200',    textClass: 'text-teal-700' },
  { key: 'nurture',            label: 'Nurture',             desc: 'Between programs, maintaining relationship, sharing value',          headerClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' },
  { key: 'renewal_outreach',   label: 'Renewal Outreach',    desc: 'Approaching plan year renewal, proposing next year\'s programs',     headerClass: 'bg-amber-50 border-amber-300',  textClass: 'text-amber-700' },
  { key: 're_engage',          label: 'Re-engage',           desc: 'Gone quiet for 60+ days, need proactive outreach',                  headerClass: 'bg-red-50 border-red-300',      textClass: 'text-red-700' },
  { key: 'churned',            label: 'Churned',             desc: 'Lost client',                                                       headerClass: 'bg-rose-100 border-rose-300',   textClass: 'text-rose-700' },
  { key: '__none__',           label: 'No Stage',            desc: 'Clients with no stage set yet',                                     headerClass: 'bg-slate-50 border-slate-200',  textClass: 'text-slate-500' },
];

const NEEDS_ATTENTION_STAGES = new Set(['nurture', 'program_delivery']);

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
  const needsAttention = ago !== null && ago > 60 && NEEDS_ATTENTION_STAGES.has(client.client_stage);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Needs attention badge */}
      {needsAttention && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            ⚠ Needs attention
          </span>
        </div>
      )}

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

      {/* Stage dropdown */}
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          value={client.client_stage || '__none__'}
          onValueChange={(val) => onStageChange(client.id, val === '__none__' ? null : val)}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue placeholder="Set stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new_client_setup">New Client Setup</SelectItem>
            <SelectItem value="program_delivery">Program Delivery</SelectItem>
            <SelectItem value="followup_feedback">Follow-up & Feedback</SelectItem>
            <SelectItem value="nurture">Nurture</SelectItem>
            <SelectItem value="renewal_outreach">Renewal Outreach</SelectItem>
            <SelectItem value="re_engage">Re-engage</SelectItem>
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
  const [playbookStage, setPlaybookStage] = useState(null);

  const handleStageChange = async (clientId, newStage) => {
    await base44.entities.Client.update(clientId, { client_stage: newStage });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const filtered = ownerFilter && ownerFilter !== 'all'
    ? clients.filter(c => c.owner === ownerFilter)
    : clients;

  return (
    <>
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
              <div
                className={`rounded-t-lg border px-3 py-2 mb-2 ${stage.headerClass} ${stage.key !== '__none__' ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
                onClick={() => stage.key !== '__none__' && setPlaybookStage(stage.key)}
                title={stage.key !== '__none__' ? 'Click to view action steps' : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm ${stage.textClass}`}>{stage.label}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.textClass}`}>
                    {stageClients.length}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stage.desc}</p>
              </div>

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
    <StagePlaybookDialog
      stageKey={playbookStage}
      open={!!playbookStage}
      onClose={() => setPlaybookStage(null)}
    />
    </>
  );
}