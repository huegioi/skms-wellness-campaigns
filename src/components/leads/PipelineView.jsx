import React, { useState, useEffect } from 'react';
import { Building, User, Calendar, AlertCircle, ChevronDown } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';

const FOLLOW_UP_STAGES = [
  '',
  'Day 1 - LinkedIn Connection',
  'Day 2 - Send email #1',
  'Day 3 - Call #1',
  'Day 3 - Text f/u to call',
  'Day 5 - Call #2',
  'Day 5 - LinkedIn f/u message',
  'Day 7 - Send email #2',
  'Day 10 - Call #3',
  'Day 10 - Send email #3',
  'Day 11 - LinkedIn message #3',
  'Day 15 - Send email #4',
  'Day 20 - Send email #5',
  'Referral Partner',
];

function extractDayNumber(stage) {
  if (!stage) return null;
  const match = stage.match(/Day\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function sortStages(stages) {
  return [...stages].sort((a, b) => {
    if (!a) return -1;
    if (!b) return 1;
    const isRefA = a.toLowerCase().includes('referral partner');
    const isRefB = b.toLowerCase().includes('referral partner');
    if (isRefA && !isRefB) return 1;
    if (!isRefA && isRefB) return -1;
    const dayA = extractDayNumber(a);
    const dayB = extractDayNumber(b);
    if (dayA !== null && dayB !== null) return dayA - dayB;
    if (dayA !== null) return -1;
    if (dayB !== null) return 1;
    return a.localeCompare(b);
  });
}

function getDueDateStatus(dueDateStr) {
  if (!dueDateStr) return null;
  try {
    const date = parseISO(dueDateStr);
    if (isToday(date)) return 'today';
    if (isPast(date)) return 'overdue';
    return 'upcoming';
  } catch {
    return null;
  }
}

function StageDropdown({ currentStage, onStageChange, saving }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (stage) => {
    setOpen(false);
    if (stage !== currentStage) onStageChange(stage);
  };

  return (
    <div className="relative mt-2" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className="w-full flex items-center justify-between gap-1 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md px-2 py-1 text-gray-600 font-medium transition-colors disabled:opacity-50"
      >
        <span className="truncate">{currentStage || 'Set stage…'}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto max-h-64">
          {FOLLOW_UP_STAGES.map((stage, i) => (
            <button
              key={i}
              onClick={() => handleSelect(stage)}
              className={`w-full text-left text-xs px-3 py-2 hover:bg-blue-50 transition-colors ${stage === currentStage ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
            >
              {stage || <span className="text-gray-400 italic">— No Stage —</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PartnerCard({ lead, onClick, onStageChange }) {
  const [saving, setSaving] = useState(false);
  const [localStage, setLocalStage] = useState(lead.follow_up_stage || '');

  // Debug: confirm what value is arriving from the parent
  console.log('PartnerCard lead.follow_up_stage:', lead.follow_up_stage, '| lead.name:', lead.name);

  // Keep localStage in sync when the lead prop changes (e.g. after a sync)
  useEffect(() => {
    console.log('useEffect syncing localStage:', lead.follow_up_stage, '| lead.name:', lead.name);
    setLocalStage(lead.follow_up_stage || '');
  }, [lead.follow_up_stage]);

  const dueDateStatus = getDueDateStatus(lead.follow_up_due_date);
  const isActivePartner = lead.partner_status === 'Active Partner';

  const cardBg =
    dueDateStatus === 'overdue' ? 'bg-red-50 border border-red-200' :
    dueDateStatus === 'today' ? 'bg-amber-50 border border-amber-200' :
    'bg-white border border-gray-200';

  const handleStageChange = async (newStage) => {
    setSaving(true);
    setLocalStage(newStage);
    try {
      await base44.entities.Lead.update(lead.id, { follow_up_stage: newStage || null });
      // Write back to Google Sheet
      await base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updateStage',
        leadId: lead.id,
        sheetRowId: lead.sheet_row_id,
        sheetName: lead.sheet_origin?.replace('BrokerLeads:', '') || undefined,
        follow_up_stage: newStage,
      });
      if (onStageChange) onStageChange(lead.id, newStage);
    } catch (e) {
      console.error('Stage update failed', e);
      setLocalStage(lead.follow_up_stage || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-full rounded-lg p-3 shadow-sm hover:shadow-md transition-all ${cardBg}`}>
      {/* Clickable area */}
      <button
        onClick={() => onClick && onClick(lead)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="font-semibold text-gray-800 text-sm leading-tight">{lead.name}</p>
          {dueDateStatus === 'overdue' && (
            <span className="flex-shrink-0 text-xs bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
              <AlertCircle className="w-2.5 h-2.5" /> Overdue
            </span>
          )}
          {dueDateStatus === 'today' && (
            <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-semibold">
              Due Today
            </span>
          )}
        </div>

        {lead.company && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Building className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.company}</span>
          </p>
        )}

        {lead.owner && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
            <User className="w-3 h-3 flex-shrink-0" />
            {lead.owner}
          </p>
        )}

        {lead.follow_up_due_date && (
          <p className={`text-xs flex items-center gap-1 mt-1 font-medium ${
            dueDateStatus === 'overdue' ? 'text-red-600' :
            dueDateStatus === 'today' ? 'text-amber-700' :
            'text-gray-500'
          }`}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {format(parseISO(lead.follow_up_due_date), 'MMM d, yyyy')}
          </p>
        )}

        {isActivePartner && (
          <div className="mt-1.5">
            <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
              Active Partner
            </span>
          </div>
        )}
      </button>

      {/* Stage dropdown — outside the clickable button */}
      <StageDropdown
        currentStage={localStage}
        onStageChange={handleStageChange}
        saving={saving}
      />
      {saving && <p className="text-xs text-blue-500 mt-1">Saving…</p>}
    </div>
  );
}

export default function PipelineView({ leads, onSelectLead, onStageChange }) {
  const stageMap = {};
  for (const lead of leads) {
    const stage = lead.follow_up_stage || '';
    if (!stageMap[stage]) stageMap[stage] = [];
    stageMap[stage].push(lead);
  }

  const sortedStages = sortStages(Object.keys(stageMap));

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow">
        <p className="text-gray-500">No partners to display in pipeline view.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {sortedStages.map(stage => {
          const stageLeads = stageMap[stage];
          const overdueCount = stageLeads.filter(l => getDueDateStatus(l.follow_up_due_date) === 'overdue').length;
          const dueTodayCount = stageLeads.filter(l => getDueDateStatus(l.follow_up_due_date) === 'today').length;

          return (
            <div key={stage || '__no_stage__'} className="w-64 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm px-3 py-2.5 mb-3 border border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-700 truncate">
                    {stage || 'No Stage'}
                  </p>
                  <span className="flex-shrink-0 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-bold">
                    {stageLeads.length}
                  </span>
                </div>
                {(overdueCount > 0 || dueTodayCount > 0) && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {overdueCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-medium">
                        {overdueCount} overdue
                      </span>
                    )}
                    {dueTodayCount > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-medium">
                        {dueTodayCount} due today
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {stageLeads.map(lead => (
                  <PartnerCard
                    key={lead.id}
                    lead={lead}
                    onClick={onSelectLead}
                    onStageChange={onStageChange}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}