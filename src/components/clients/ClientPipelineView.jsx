import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { differenceInDays, parseISO } from 'date-fns';
import StagePlaybookDialog from './StagePlaybookDialog';

const SALES_STAGES = [
  { key: 'discovery_call_scheduled', label: 'Discovery Call Scheduled', desc: 'Call booked, preparing for first conversation', headerClass: 'bg-sky-50 border-sky-200', textClass: 'text-sky-700' },
  { key: 'discovery_call_complete',  label: 'Discovery Call Complete',  desc: 'Call done, assessing fit and next steps',    headerClass: 'bg-cyan-50 border-cyan-200', textClass: 'text-cyan-700' },
  { key: 'proposal_sent',            label: 'Proposal Sent',            desc: 'Proposal delivered, awaiting response',      headerClass: 'bg-indigo-50 border-indigo-200', textClass: 'text-indigo-700' },
  { key: 'proposal_viewed',          label: 'Proposal Viewed',          desc: 'Prospect opened the proposal — act fast',    headerClass: 'bg-violet-50 border-violet-200', textClass: 'text-violet-700' },
  { key: 'negotiation',              label: 'Negotiation',              desc: 'Active back-and-forth on scope and pricing',  headerClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' },
  { key: 'verbal_yes',               label: 'Verbal Yes',               desc: 'Commitment received — closing the deal',     headerClass: 'bg-blue-50 border-blue-300', textClass: 'text-blue-800' },
];

const LIFECYCLE_STAGES = [
  { key: 'new_client_setup',  label: 'New Client Setup',    desc: 'Completing onboarding tasks, scheduling first programs',           headerClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' },
  { key: 'program_delivery',  label: 'Program Delivery',    desc: 'Actively delivering workshops, challenges, boxes',                 headerClass: 'bg-green-50 border-green-200',   textClass: 'text-green-700' },
  { key: 'followup_feedback', label: 'Follow-up & Feedback',desc: 'Collecting surveys, building ROI reports',                        headerClass: 'bg-teal-50 border-teal-200',     textClass: 'text-teal-700' },
  { key: 'nurture',           label: 'Nurture',             desc: 'Between programs, maintaining relationship',                      headerClass: 'bg-purple-50 border-purple-200', textClass: 'text-purple-700' },
  { key: 'renewal_outreach',  label: 'Renewal Outreach',    desc: 'Approaching plan year renewal, proposing next year\'s programs',   headerClass: 'bg-amber-50 border-amber-300',   textClass: 'text-amber-700' },
  { key: 're_engage',         label: 'Re-engage',           desc: 'Gone quiet for 60+ days, need proactive outreach',                headerClass: 'bg-red-50 border-red-300',       textClass: 'text-red-700' },
  { key: 'churned',           label: 'Churned',             desc: 'Lost client',                                                     headerClass: 'bg-rose-100 border-rose-300',    textClass: 'text-rose-700' },
  { key: '__none__',          label: 'No Stage',            desc: 'Clients with no stage set yet',                                   headerClass: 'bg-slate-50 border-slate-200',   textClass: 'text-slate-500' },
];

const NEEDS_ATTENTION_STAGES = new Set(['nurture', 'program_delivery']);

function daysAgo(dateStr) {
  if (!dateStr) return null;
  try {
    const d = typeof dateStr === 'string' && dateStr.length <= 10 ? parseISO(dateStr) : new Date(dateStr);
    return differenceInDays(new Date(), d);
  } catch { return null; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  try { return differenceInDays(parseISO(dateStr), new Date()); }
  catch { return null; }
}

function RenewalBadge({ dateStr }) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return <span className="text-xs font-medium text-red-600">Expired</span>;
  if (days <= 30) return <span className="text-xs font-medium text-red-600">Renews in {days}d</span>;
  if (days <= 90) return <span className="text-xs font-medium text-amber-600">Renews in {days}d</span>;
  return <span className="text-xs text-gray-400">Renews in {days}d</span>;
}

function SalesAlertBadge({ client }) {
  const stage = client.client_stage;
  const stageEnteredDays = client.stage_entered_date ? daysAgo(client.stage_entered_date) : null;
  const lastActivityDays = daysAgo(client.last_contacted_date || client.last_contacted);

  if (stage === 'proposal_sent') {
    const staleDays = lastActivityDays ?? stageEnteredDays;
    if (staleDays !== null && staleDays >= 7) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
          ⏰ Follow up needed
        </span>
      );
    }
  }

  if (stage === 'discovery_call_scheduled' && client.plan_year_start) {
    const daysLeft = daysUntil(client.plan_year_start);
    if (daysLeft !== null && daysLeft < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-2 py-0.5">
          🔴 Call overdue
        </span>
      );
    }
  }

  if (stage === 'negotiation' && stageEnteredDays !== null && stageEnteredDays >= 14) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
        ⚠ Stalling
      </span>
    );
  }

  return null;
}

function ClientCard({ client, onStageChange, onClick, isSalesStage }) {
  const ago = daysAgo(client.last_contacted_date || client.last_contacted);
  const needsAttention = ago !== null && ago > 60 && NEEDS_ATTENTION_STAGES.has(client.client_stage);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Alert badges */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {needsAttention && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            ⚠ Needs attention
          </span>
        )}
        {isSalesStage && <SalesAlertBadge client={client} />}
      </div>

      {/* Name + Company */}
      <div className="mb-1">
        <p className="font-semibold text-[#264d44] text-sm leading-tight">{client.company || client.name}</p>
        {client.company && <p className="text-xs text-gray-500">{client.name}</p>}
      </div>

      {client.owner && <p className="text-xs text-gray-500 mb-1.5">👤 {client.owner}</p>}

      {ago !== null ? (
        <p className={`text-xs mb-1 ${ago > 60 ? 'text-red-500 font-medium' : ago > 30 ? 'text-amber-600' : 'text-gray-500'}`}>
          Last contact: {ago === 0 ? 'today' : `${ago}d ago`}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-1">No contact recorded</p>
      )}

      {client.renewal_date && (
        <div className="mb-1.5"><RenewalBadge dateStr={client.renewal_date} /></div>
      )}

      <div className="flex items-center gap-3 mb-2 text-xs text-gray-600">
        {(client.total_invoice_value || 0) > 0 && (
          <span className="text-green-700 font-medium">${client.total_invoice_value.toLocaleString()}</span>
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
            <SelectItem value="discovery_call_scheduled" className="text-sky-700 font-medium">Discovery Call Scheduled</SelectItem>
            <SelectItem value="discovery_call_complete" className="text-cyan-700 font-medium">Discovery Call Complete</SelectItem>
            <SelectItem value="proposal_sent" className="text-indigo-700 font-medium">Proposal Sent</SelectItem>
            <SelectItem value="proposal_viewed" className="text-violet-700 font-medium">Proposal Viewed</SelectItem>
            <SelectItem value="negotiation" className="text-purple-700 font-medium">Negotiation</SelectItem>
            <SelectItem value="verbal_yes" className="text-blue-800 font-medium">Verbal Yes</SelectItem>
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

function StageColumn({ stage, clients, onStageChange, onClientClick, onHeaderClick, isSalesStage }) {
  return (
    <div className="w-56 flex-shrink-0">
      <div
        className={`rounded-t-lg border px-3 py-2 mb-2 ${stage.headerClass} ${stage.key !== '__none__' ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
        onClick={() => stage.key !== '__none__' && onHeaderClick(stage.key)}
        title={stage.key !== '__none__' ? 'Click to view action steps' : undefined}
      >
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-sm ${stage.textClass}`}>{stage.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.textClass}`}>
            {clients.length}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stage.desc}</p>
      </div>

      <div className="space-y-2">
        {clients.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
            No clients
          </div>
        ) : (
          clients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onStageChange={onStageChange}
              onClick={() => onClientClick(client)}
              isSalesStage={isSalesStage}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ClientPipelineView({ clients, ownerFilter, onClientClick }) {
  const queryClient = useQueryClient();
  const [playbookStage, setPlaybookStage] = useState(null);

  const handleStageChange = async (clientId, newStage) => {
    await base44.entities.Client.update(clientId, { client_stage: newStage, stage_entered_date: new Date().toISOString().split('T')[0] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const filtered = ownerFilter && ownerFilter !== 'all'
    ? clients.filter(c => c.owner === ownerFilter)
    : clients;

  const stageClients = (key) => filtered.filter(c =>
    key === '__none__' ? !c.client_stage : c.client_stage === key
  );

  const salesTotal = SALES_STAGES.reduce((sum, s) => sum + stageClients(s.key).length, 0);
  const lifecycleTotal = LIFECYCLE_STAGES.reduce((sum, s) => sum + stageClients(s.key).length, 0);

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="flex flex-col gap-4 min-w-max">

          {/* ── Sales Pipeline section ── */}
          <div>
            <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)' }}>
              <span className="text-white font-bold text-sm tracking-wide">🔵 Sales Pipeline</span>
              <span className="ml-auto text-blue-100 text-xs font-medium">{salesTotal} prospect{salesTotal !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-4">
              {SALES_STAGES.map(stage => (
                <StageColumn
                  key={stage.key}
                  stage={stage}
                  clients={stageClients(stage.key)}
                  onStageChange={handleStageChange}
                  onClientClick={onClientClick}
                  onHeaderClick={setPlaybookStage}
                  isSalesStage={true}
                />
              ))}
            </div>
          </div>

          {/* ── Client Lifecycle section ── */}
          <div>
            <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #166534 0%, #16a34a 100%)' }}>
              <span className="text-white font-bold text-sm tracking-wide">🟢 Client Lifecycle</span>
              <span className="ml-auto text-green-100 text-xs font-medium">{lifecycleTotal} client{lifecycleTotal !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-4">
              {LIFECYCLE_STAGES.map(stage => (
                <StageColumn
                  key={stage.key}
                  stage={stage}
                  clients={stageClients(stage.key)}
                  onStageChange={handleStageChange}
                  onClientClick={onClientClick}
                  onHeaderClick={setPlaybookStage}
                  isSalesStage={false}
                />
              ))}
            </div>
          </div>

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