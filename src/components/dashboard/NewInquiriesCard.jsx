import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Users, ArrowRight, Sparkles, Package, Gift, Handshake, ClipboardCheck } from 'lucide-react';
import { parseQuickBuilderGoals, parseWellnessBoxesPreference, timeSince, isNewQuickBuilderInquiry } from '@/lib/quickbuilderUtils';

export default function NewInquiriesCard() {
  const { data: rawLeads = [] } = useQuery({
    queryKey: ['leads', 'company_inquiry'],
    queryFn: () => base44.entities.Lead.filter({ lead_type: 'company_inquiry' }, '-created_date'),
    staleTime: 60_000,
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const allLeads = rawLeads.filter(l => !l.is_demo);

  // Include both Quick Builder and Mental Fitness Score inquiries
  const newInquiries = allLeads.filter(l => {
    if (isNewQuickBuilderInquiry(l)) return true;
    return (l.source || '').startsWith('Mental Fitness Score') &&
           (l.status || 'cold') === 'cold' &&
           !l.last_contacted_date;
  });

  // Fetch MFS assessments + response counts for the "Assessment" badge
  const { data: mfsAssessments = [] } = useQuery({
    queryKey: ['mfs-assessments'],
    queryFn: () => base44.entities.MfsAssessment.list('-created_date', 100),
    staleTime: 60_000,
  });

  const { data: mfsResponses = [] } = useQuery({
    queryKey: ['mfs-responses', 'counts'],
    queryFn: () => base44.entities.CohortAssessment.filter({ survey_type: 'mfs' }, '-submitted_at', 500),
    staleTime: 60_000,
  });

  const leadToAssessment = useMemo(() => {
    const map = {};
    for (const a of mfsAssessments) {
      if (a.lead_id) map[a.lead_id] = a;
    }
    return map;
  }, [mfsAssessments]);

  const responseCountByClient = useMemo(() => {
    const map = {};
    for (const r of mfsResponses) {
      if (r.client_id) map[r.client_id] = (map[r.client_id] || 0) + 1;
    }
    return map;
  }, [mfsResponses]);

  // Fetch recent referrals to resolve partner names for inquiries that came via a partner ref
  const { data: recentReferrals = [] } = useQuery({
    queryKey: ['referrals', 'for-inquiries'],
    queryFn: () => base44.entities.Referral.list('-referral_date', 50),
    staleTime: 60_000,
  });

  const leadIdToPartner = useMemo(() => {
    const map = {};
    for (const r of recentReferrals) {
      if (r.is_demo) continue;
      if (r.referred_lead_id && r.referral_partner_name) {
        map[r.referred_lead_id] = r.referral_partner_name;
      }
    }
    return map;
  }, [recentReferrals]);

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
            <h2 className="font-bold text-gray-800 text-base leading-tight">New Inquiries</h2>
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
          const isMfs = (lead.source || '').startsWith('Mental Fitness Score');
          const assessment = leadToAssessment[lead.id];
          const responseCount = assessment ? (responseCountByClient[assessment.client_id] || 0) : 0;
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
                  {leadIdToPartner[lead.id] && (
                    <span className="text-xs text-[#264d44] font-medium flex items-center gap-0.5">
                      <Handshake className="w-3 h-3" />via {leadIdToPartner[lead.id]}
                    </span>
                  )}
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
                  {isMfs && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                      <ClipboardCheck className="w-2.5 h-2.5" />Assessment · {responseCount} response{responseCount !== 1 ? 's' : ''}
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