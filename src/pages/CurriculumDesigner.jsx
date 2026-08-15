import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import StepIndicator from '../components/curriculum/StepIndicator';
import AssessmentStep from '../components/curriculum/AssessmentStep';
import ImpactStep from '../components/curriculum/ImpactStep';
import WorkshopStep from '../components/curriculum/WorkshopStep';
import ChallengeStep from '../components/curriculum/ChallengeStep';
import WellnessBoxStep from '../components/curriculum/WellnessBoxStep';
import MovementStep from '../components/curriculum/MovementStep';
import LeadershipStep from '../components/curriculum/LeadershipStep';
import ReviewStep from '../components/curriculum/ReviewStep';
import { suggestServicesFromMfs } from '@/lib/mfsServiceMapping';
import { Sparkles, X, History } from 'lucide-react';
import { enumToApproxCount } from '@/components/curriculum/pricingUtils';
import { timeSince } from '@/lib/quickbuilderUtils';

// Draft persistence: everything on this wizard lives in page state, so a
// refresh mid-call used to lose the whole session. Drafts autosave locally
// and a banner offers to resume the most recent one.
const DRAFT_KEY = 'curriculumDesignerDraft.v1';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const draftHasContent = (sel) =>
  !!(sel?.assessmentData?.companyName || sel?.assessmentData?.companySize ||
     sel?.challenges?.length || sel?.workshops?.length || sel?.challengePrograms?.length ||
     sel?.leadership?.length || sel?.movementClasses?.length || sel?.impact);

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.ts || Date.now() - draft.ts > DRAFT_MAX_AGE_MS) return null;
    if (!draftHasContent(draft.selections)) return null;
    return draft;
  } catch { return null; }
}

export default function CurriculumDesigner() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selections, setSelections] = useState({
    assessmentData: {},
    challenges: [],
    workshops: [],
    challengePrograms: [],
    leadership: [],
    movementClasses: [],
    smallBoxes: 0,
    largeBoxes: 0
  });
  const [clientLoaded, setClientLoaded] = useState(false);
  const [leadLoaded, setLeadLoaded] = useState(false);
  const [pendingQbSelections, setPendingQbSelections] = useState([]);
  const [matchedStage, setMatchedStage] = useState('');
  const [mfsLabels, setMfsLabels] = useState([]);
  const [availableDraft, setAvailableDraft] = useState(null);
  const [searchParams] = useSearchParams();

  // Offer to resume a saved draft — but not when arriving with a client/lead
  // prefill, which is a deliberate fresh start from that record.
  React.useEffect(() => {
    if (searchParams.get('clientId') || searchParams.get('leadId')) return;
    const draft = readDraft();
    if (draft) setAvailableDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave whenever the session has real content. (Skipped while the resume
  // banner is up, so an untouched page never overwrites the draft on offer.)
  React.useEffect(() => {
    if (availableDraft) return;
    if (!draftHasContent(selections)) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ selections, currentStep, matchedStage, ts: Date.now() }));
    } catch { /* storage full/unavailable — non-fatal */ }
  }, [selections, currentStep, matchedStage, availableDraft]);

  const resumeDraft = () => {
    if (!availableDraft) return;
    setSelections(availableDraft.selections);
    setCurrentStep(availableDraft.currentStep || 1);
    setMatchedStage(availableDraft.matchedStage || '');
    setAvailableDraft(null);
  };

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setAvailableDraft(null);
  };

  // Pre-load client data from URL param
  React.useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (!clientId || clientLoaded) return;
    base44.entities.Client.filter({ id: clientId }).then(results => {
      const client = results[0];
      if (!client) return;
      const primaryBroker = (client.brokers && client.brokers[0]) || {};
      setSelections(prev => ({
        ...prev,
        assessmentData: {
          ...prev.assessmentData,
          clientName: client.name || '',
          clientEmail: client.email || '',
          companyName: client.company || '',
          companyAddress: client.company_address || '',
          companySize: client.employee_count || enumToApproxCount(client.company_size) || '',
          brokerName: primaryBroker.name || client.broker_name || '',
          brokerEmail: primaryBroker.email || client.broker_email || '',
          brokerCompany: primaryBroker.company || '',
          consultantName: client.wellness_consultant_name || '',
          consultantEmail: client.wellness_consultant_email || '',
          consultantCompany: '',
          industry: client.industry || '',
        }
      }));
      setClientLoaded(true);
    }).catch(() => {});
  }, [clientLoaded, searchParams]);

  // Pre-load Quick Builder lead data from URL param
  React.useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId || leadLoaded) return;
    base44.entities.Lead.filter({ id: leadId }).then(results => {
      const lead = results[0];
      if (!lead) return;
      setSelections(prev => ({
        ...prev,
        assessmentData: {
          ...prev.assessmentData,
          clientName: lead.name || '',
          clientEmail: lead.email || '',
          companyName: lead.company || '',
          companySize: lead.company_size || '',
          industry: lead.industry || '',
        }
      }));
      if (lead.quickbuilder_selections?.length) {
        setPendingQbSelections(lead.quickbuilder_selections);
      }
      setMatchedStage(lead.matched_stage || searchParams.get('stage') || '');
      setLeadLoaded(true);
    }).catch(() => {});
  }, [leadLoaded, searchParams]);

  const { data: allServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  // Distribute pending Quick Builder selections into the matching step arrays
  React.useEffect(() => {
    if (pendingQbSelections.length === 0 || allServices.length === 0) return;
    const buckets = { workshop: [], challenge: [], leadership: [], class: [] };
    pendingQbSelections.forEach(serviceId => {
      const svc = allServices.find(s => s.id === serviceId);
      if (!svc || !buckets[svc.category]) return;
      buckets[svc.category].push(serviceId);
    });
    setSelections(prev => ({
      ...prev,
      workshops: [...new Set([...(prev.workshops || []), ...buckets.workshop])],
      challengePrograms: [...new Set([...(prev.challengePrograms || []), ...buckets.challenge])],
      leadership: [...new Set([...(prev.leadership || []), ...buckets.leadership])],
      movementClasses: [...new Set([...(prev.movementClasses || []), ...buckets.class])],
    }));
    setPendingQbSelections([]);
  }, [pendingQbSelections, allServices]);

  // Pre-fill from MFS assessment data for assessment leads
  React.useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (!clientId || !clientLoaded || allServices.length === 0) return;

    (async () => {
      try {
        const assessments = await base44.entities.MfsAssessment.filter({ client_id: clientId }, '-created_date', 1);
        if (!assessments || assessments.length === 0) return;
        const res = await base44.functions.invoke('getMfsResults', { token: assessments[0].token });
        if (!res.data || res.data.locked || !res.data.instruments) return;

        const suggested = suggestServicesFromMfs(res.data.instruments, allServices);
        if (suggested.labels.length === 0) return;
        setMfsLabels(suggested.labels);
        setSelections(prev => ({
          ...prev,
          workshops: [...new Set([...(prev.workshops || []), ...suggested.workshops])],
          challengePrograms: [...new Set([...(prev.challengePrograms || []), ...suggested.challengePrograms])],
          leadership: [...new Set([...(prev.leadership || []), ...suggested.leadership])],
          movementClasses: [...new Set([...(prev.movementClasses || []), ...suggested.movementClasses])],
        }));
      } catch { /* non-fatal */ }
    })();
  }, [clientLoaded, allServices, searchParams]);

  const workshopServices = allServices.filter(s => s.category === 'workshop' && s.is_active !== false);
  const challengeServices = allServices.filter(s => s.category === 'challenge' && s.is_active !== false);
  const classServices = allServices.filter(s => s.category === 'class' && s.is_active !== false);
  const leadershipServices = allServices.filter(s => s.category === 'leadership' && s.is_active !== false);

  const steps = [
    { number: 1, name: 'Assessment' },
    { number: 2, name: 'Impact' },
    { number: 3, name: 'Workshops' },
    { number: 4, name: 'Challenges' },
    { number: 5, name: 'Classes' },
    { number: 6, name: 'Leadership' },
    { number: 7, name: 'Incentives' },
    { number: 8, name: 'Review' }
  ];

  // Which steps already hold content — rendered as a small tick on the
  // indicator so it's obvious at a glance what's been filled in.
  const contentSteps = [
    !!(selections.assessmentData?.companyName && selections.assessmentData?.companySize) && 1,
    !!selections.impact?.stageNum && 2,
    (selections.workshops || []).length > 0 && 3,
    (selections.challengePrograms || []).length > 0 && 4,
    (selections.movementClasses || []).length > 0 && 5,
    (selections.leadership || []).length > 0 && 6,
    ((selections.smallBoxes || 0) + (selections.largeBoxes || 0)) > 0 && 7,
  ].filter(Boolean);

  const updateSelections = (key, value) => {
    setSelections(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (stepNumber) => {
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <AssessmentStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            isFirstStep={true}
          />
        );
      case 2:
        return (
          <ImpactStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            onStageChange={setMatchedStage}
          />
        );
      case 3:
        return (
          <WorkshopStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={workshopServices}
          />
        );
      case 4:
        return (
          <ChallengeStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={challengeServices}
            allServices={allServices}
          />
        );
      case 5:
        return (
          <MovementStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={classServices}
          />
        );
      case 6:
        return (
          <LeadershipStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={leadershipServices}
          />
        );
      case 7:
        return (
          <WellnessBoxStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 8:
        return (
          <ReviewStep
            selections={selections}
            allServices={allServices}
            onBack={handleBack}
            matchedStage={matchedStage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 md:mb-10 text-center">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/abfb649ad_SkillfulMeansWebsiteHero.png" 
            alt="SkillfulMeans" 
            className="mx-auto mb-4 md:mb-6"
            style={{ maxWidth: '400px', width: '100%', height: 'auto' }}
          />
          <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4" style={{ color: '#013f7c' }}>Build Your Mental Fitness Campaign
          </h1>
          <p className="text-sm md:text-lg" style={{ color: '#666' }}>
            Create a customized mental fitness program for your organization
          </p>
        </div>

        {availableDraft && (
          <div className="mb-6 rounded-xl border-l-4 border-l-[#013f7c] bg-white p-4 flex items-center gap-3 shadow-sm">
            <History className="w-5 h-5 text-[#013f7c] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#013f7c] text-sm">
                Pick up where you left off{availableDraft.selections?.assessmentData?.companyName ? ` — ${availableDraft.selections.assessmentData.companyName}` : ''}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Saved {timeSince(new Date(availableDraft.ts).toISOString())}</p>
            </div>
            <button onClick={resumeDraft} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[#013f7c] hover:opacity-90 shrink-0">
              Resume
            </button>
            <button onClick={discardDraft} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 shrink-0">
              Discard
            </button>
          </div>
        )}

        <StepIndicator steps={steps} currentStep={currentStep} onStepClick={handleStepClick} contentSteps={contentSteps} />

        {mfsLabels.length > 0 && (
          <div className="mb-6 rounded-xl border-l-4 border-l-[#770142] bg-gradient-to-r from-[#f9f8f5] to-[#f0ebe0] p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#770142] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-[#770142] text-sm">MFS-Informed Suggestions</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Based on this team's Mental Fitness Score ({mfsLabels.join(' · ')}), we've pre-selected services that target the weakest areas. Review and adjust as needed.
              </p>
            </div>
            <button onClick={() => setMfsLabels([])} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
}