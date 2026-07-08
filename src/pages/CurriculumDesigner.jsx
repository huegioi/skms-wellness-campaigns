import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import StepIndicator from '../components/curriculum/StepIndicator';
import AssessmentStep from '../components/curriculum/AssessmentStep';
import WorkshopStep from '../components/curriculum/WorkshopStep';
import ChallengeStep from '../components/curriculum/ChallengeStep';
import WellnessBoxStep from '../components/curriculum/WellnessBoxStep';
import MovementStep from '../components/curriculum/MovementStep';
import LeadershipStep from '../components/curriculum/LeadershipStep';
import ReviewStep from '../components/curriculum/ReviewStep';

const enumToApproxCount = (size) => ({
  '1-50': 25, '51-200': 125, '201-500': 350,
  '501-1000': 750, '1001-5000': 3000, '5000+': 5000,
}[size] || '');

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
  const [searchParams] = useSearchParams();

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
          wellnessBudget: client.wellness_budget || '',
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

  const workshopServices = allServices.filter(s => s.category === 'workshop' && s.is_active !== false);
  const challengeServices = allServices.filter(s => s.category === 'challenge' && s.is_active !== false);
  const classServices = allServices.filter(s => s.category === 'class' && s.is_active !== false);
  const leadershipServices = allServices.filter(s => s.category === 'leadership' && s.is_active !== false);

  const steps = [
    { number: 1, name: 'Assessment' },
    { number: 2, name: 'Workshops' },
    { number: 3, name: 'Challenges' },
    { number: 4, name: 'Classes' },
    { number: 5, name: 'Leadership' },
    { number: 6, name: 'Incentives' },
    { number: 7, name: 'Review' }
  ];

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
          <WorkshopStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={workshopServices}
          />
        );
      case 3:
        return (
          <ChallengeStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={challengeServices}
          />
        );
      case 4:
        return (
          <MovementStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={classServices}
          />
        );
      case 5:
        return (
          <LeadershipStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            catalogServices={leadershipServices}
          />
        );
      case 6:
        return (
          <WellnessBoxStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 7:
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
          <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4" style={{ color: '#013f7c' }}>
            Build Your Wellness Campaign
          </h1>
          <p className="text-sm md:text-lg" style={{ color: '#666' }}>
            Create a customized mental fitness program for your organization
          </p>
        </div>

        <StepIndicator steps={steps} currentStep={currentStep} onStepClick={handleStepClick} />

        {renderStep()}
      </div>
    </div>
  );
}