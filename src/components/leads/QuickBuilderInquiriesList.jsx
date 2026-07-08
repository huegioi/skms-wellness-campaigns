import React from 'react';
import { User, Mail, Users, ArrowRight, Sparkles, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { parseQuickBuilderGoals, timeSince } from '@/lib/quickbuilderUtils';

export default function QuickBuilderInquiriesList({ inquiries, onSelectLead }) {
  if (inquiries.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow">
        <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500">No new Quick Builder inquiries.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inquiries.map(lead => {
        const goals = parseQuickBuilderGoals(lead.notes);
        const selCount = lead.quickbuilder_selections?.length || 0;
        return (
          <div key={lead.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-[#013f7c]/30">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    className="font-semibold text-gray-800 hover:text-[#013f7c] hover:underline text-left"
                    onClick={() => onSelectLead(lead)}
                  >
                    {lead.company || 'Unknown company'}
                  </button>
                  <Badge variant="outline" className="text-xs bg-[#013f7c]/10 text-[#013f7c] border-[#013f7c]/20">
                    Quick Builder
                  </Badge>
                  <span className="text-xs text-gray-400">{timeSince(lead.created_date)}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.name}</span>
                  {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                  {lead.company_size && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{lead.company_size}</span>}
                </div>
                {goals.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {goals.map(g => (
                      <span key={g} className="text-xs bg-[#013f7c]/10 text-[#013f7c] px-2 py-0.5 rounded-full font-medium">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {selCount > 0 && (
                  <p className="text-xs text-[#264d44] font-medium mt-2 flex items-center gap-1">
                    <Package className="w-3 h-3" />{selCount} service{selCount !== 1 ? 's' : ''} selected
                  </p>
                )}
                {(lead.matched_stage || lead.estimated_investment != null) && (
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {lead.matched_stage && (
                      <span className="text-xs bg-[#013f7c]/10 text-[#013f7c] px-2 py-0.5 rounded-full font-medium">
                        {lead.matched_stage}
                      </span>
                    )}
                    {lead.estimated_investment != null && (
                      <span className="text-xs bg-[#264d44]/10 text-[#264d44] px-2 py-0.5 rounded-full font-medium">
                        ~${lead.estimated_investment.toLocaleString()} est.
                      </span>
                    )}
                  </div>
                )}
                {lead.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{lead.notes}</p>}
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => onSelectLead(lead)}
                  className="text-sm font-semibold text-[#770142] hover:underline flex items-center gap-1"
                >
                  Review <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}