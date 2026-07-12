import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Users, ArrowRight, Sparkles, Package, Gift } from 'lucide-react';
import { parseQuickBuilderGoals, parseWellnessBoxesPreference, timeSince, isNewQuickBuilderInquiry } from '@/lib/quickbuilderUtils';

export default function NewInquiriesCard() {
  const { data: rawLeads = [] } = useQuery({
    queryKey: ['leads', 'company_inquiry'],
    queryFn: () => base44.entities.Lead.filter({ lead_type: 'company_inquiry' }, '-created_date'),
    staleTime: 60_000,
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const allLeads = rawLeads.filter(l => !l.is_demo);

  const newInquiries = allLeads.filter(isNewQuickBuilderInquiry);

  if (newInquiries.length === 0) return null;

  const top5 = newInquiries.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-[#013f7c]/15 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#013f7c15' }}>
            <Sparkles className="w-4 h-4 text-[#013f7c]" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-base leading-tight">New Quick Builder Inquiries</h2>
            <p className="text-xs text-gray-400">
              {newInquiries.length} new inquiry{newInquiries.length !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
        </div>
        <Link
          to="/Leads?filter=quick_builder"
          className="text-sm font-semibold text-[#013f7c] hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {top5.map(lead => {
          const goals = parseQuickBuilderGoals(lead.notes);
          const wantsBoxes = parseWellnessBoxesPreference(lead.notes);
          const selCount = lead.quickbuilder_selections?.length || 0;
          return (
            <div
              key={lead.id}
              className="flex items-center gap-3 bg-[#f9f8f5] rounded-xl p-3 hover:bg-[#f3f1ea] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800 truncate">
                    {lead.company || 'Unknown company'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <User className="w-3 h-3" />{lead.name}
                  </span>
                  {lead.company_size && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Users className="w-3 h-3" />{lead.company_size}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{timeSince(lead.created_date)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {goals.map(g => (
                    <span key={g} className="text-[10px] bg-[#013f7c]/10 text-[#013f7c] px-1.5 py-0.5 rounded-full font-medium">
                      {g}
                    </span>
                  ))}
                  {selCount > 0 && (
                    <span className="text-[10px] bg-[#264d44]/10 text-[#264d44] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                      <Package className="w-2.5 h-2.5" />{selCount} service{selCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {wantsBoxes !== null && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${
                      wantsBoxes ? 'bg-[#7a8c1e]/10 text-[#7a8c1e]' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Gift className="w-2.5 h-2.5" />Boxes: {wantsBoxes ? 'Yes' : 'No'}
                    </span>
                  )}
                  {lead.matched_stage && (
                    <span className="text-[10px] bg-[#013f7c]/10 text-[#013f7c] px-1.5 py-0.5 rounded-full font-medium">
                      {lead.matched_stage}
                    </span>
                  )}
                  {lead.estimated_investment != null && (
                    <span className="text-[10px] bg-[#264d44]/10 text-[#264d44] px-1.5 py-0.5 rounded-full font-medium">
                      ~${lead.estimated_investment.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to={`/Leads?leadId=${lead.id}&filter=quick_builder`}
                className="flex-shrink-0 text-sm font-semibold text-[#770142] hover:underline flex items-center gap-1"
              >
                Review <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}