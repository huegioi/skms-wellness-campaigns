import React, { useState } from 'react';
import { Copy, Check, ChevronDown, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';

// Admin-only collapsed section with survey link buttons.
// Hidden from the client-facing view entirely.
export default function AdminLinkSection({ clientId, acceptedProposalId, services = [], pulseResponses = [] }) {
  const [open, setOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [copiedWho5, setCopiedWho5] = useState(null);
  const [copiedCohort, setCopiedCohort] = useState(null);

  const copyFeedbackUrl = (serviceId, serviceName) => {
    const url = `${window.location.origin}/AttendeeForm?service_id=${serviceId}&client_id=${clientId}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(serviceId);
    toast.success(`Feedback link for "${serviceName}" copied!`);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const copyWho5Url = (serviceId, serviceName, timing) => {
    const url = `${window.location.origin}/CohortAssessment?service_id=${serviceId}&client_id=${clientId}&timing=${timing}`;
    navigator.clipboard.writeText(url);
    setCopiedWho5(`${serviceId}-${timing}`);
    toast.success(`${timing === 'day0' ? 'Day 0' : 'Day 14'} check-in link for "${serviceName}" copied!`);
    setTimeout(() => setCopiedWho5(null), 2500);
  };

  const copyCohortUrl = (timing) => {
    const url = `${window.location.origin}/CohortAssessment?client_id=${clientId}&proposal_id=${acceptedProposalId}&timing=${timing}`;
    navigator.clipboard.writeText(url);
    setCopiedCohort(timing);
    toast.success(`Cohort ${timing === 'cohort_start' ? 'Start' : 'End'} check-in link copied!`);
    setTimeout(() => setCopiedCohort(null), 2500);
  };

  const activeServices = services.filter(s => s.is_active !== false);
  if (activeServices.length === 0 && !acceptedProposalId) return null;

  return (
    <div className="rounded-xl border border-[#e6e1d8] overflow-hidden" style={{ backgroundColor: '#f9f8f5' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#f4f0e9] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#013f7c]" />
          <span className="text-sm font-semibold text-[#013f7c]">Admin — Survey Links</span>
          <span className="text-xs text-gray-400">(not visible to client)</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-4">
          {/* Cohort check-in links */}
          {acceptedProposalId && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Cohort Check-In Links</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => copyCohortUrl('cohort_start')} className="text-xs border-[#013f7c] text-[#013f7c]">
                  {copiedCohort === 'cohort_start' ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Cohort Start</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyCohortUrl('cohort_end')} className="text-xs border-[#013f7c] text-[#013f7c]">
                  {copiedCohort === 'cohort_end' ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Cohort End</>}
                </Button>
              </div>
            </div>
          )}

          {/* Session pulse links */}
          {activeServices.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Session Pulse Links</p>
              <div className="space-y-2">
                {activeServices.slice(0, 8).map(s => {
                  const count = pulseResponses.filter(r => r.service_id === s.id).length;
                  return (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{count} response{count !== 1 ? 's' : ''}</p>
                        {s.included_assessments?.length > 0 && (
                          <div className="mt-1"><AssessmentBadges assessments={s.included_assessments} size="xs" /></div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <Button size="sm" variant="outline" onClick={() => copyFeedbackUrl(s.id, s.name)} className="text-xs border-[#013f7c] text-[#013f7c]">
                          {copiedUrl === s.id ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy Link</>}
                        </Button>
                        {s.category === 'challenge' && (<>
                          <Button size="sm" variant="outline" onClick={() => copyWho5Url(s.id, s.name, 'day0')} className="text-xs border-[#264d44] text-[#264d44]">
                            {copiedWho5 === `${s.id}-day0` ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Day 0</>}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyWho5Url(s.id, s.name, 'day14')} className="text-xs border-[#264d44] text-[#264d44]">
                            {copiedWho5 === `${s.id}-day14` ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Day 14</>}
                          </Button>
                        </>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}