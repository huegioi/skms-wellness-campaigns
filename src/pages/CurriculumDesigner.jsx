import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StepIndicator from '../components/curriculum/StepIndicator';
import AssessmentStep from '../components/curriculum/AssessmentStep';
import WorkshopStep from '../components/curriculum/WorkshopStep';
import ChallengeStep from '../components/curriculum/ChallengeStep';
import WellnessBoxStep from '../components/curriculum/WellnessBoxStep';
import MovementStep from '../components/curriculum/MovementStep';
import LeadershipStep from '../components/curriculum/LeadershipStep';
import ReviewStep from '../components/curriculum/ReviewStep';

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

  const { data: allServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

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

        <StepIndicator steps={steps} currentStep={currentStep} />

        {renderStep()}
      </div>
    </div>
  );
}