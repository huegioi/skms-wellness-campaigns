import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building, User, Calendar, AlertCircle } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';

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

function PartnerCard({ lead, onClick }) {
  const dueDateStatus = getDueDateStatus(lead.follow_up_due_date);
  const isActivePartner = lead.partner_status === 'Active Partner';

  const cardBg =
    dueDateStatus === 'overdue' ? 'bg-red-50 border border-red-200' :
    dueDateStatus === 'today' ? 'bg-amber-50 border border-amber-200' :
    'bg-white border border-gray-200';

  return (
    <button
      onClick={() => onClick && onClick(lead)}
      className={`w-full text-left rounded-lg p-3 shadow-sm hover:shadow-md transition-all ${cardBg}`}
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
        <p className={`text-xs flex items-center gap-1 mt-1.5 font-medium ${
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
  );
}

export default function PipelineView({ leads, onSelectLead }) {
  // Build stage groups
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
              {/* Column Header */}
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

              {/* Cards */}
              <div className="space-y-2">
                {stageLeads.map(lead => (
                  <PartnerCard key={lead.id} lead={lead} onClick={onSelectLead} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}