import React, { useState } from 'react';
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

  const steps = [
    { number: 1, name: 'Assessment' },
    { number: 2, name: 'Workshops' },
    { number: 3, name: 'Challenges' },
    { number: 4, name: 'Wellness' },
    { number: 5, name: 'Movement' },
    { number: 6, name: 'Leadership' },
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
          />
        );
      case 2:
        return (
          <WorkshopStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <ChallengeStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <WellnessBoxStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <MovementStep
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <LeadershipStep
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
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f0e9' }}>
      <style>{`
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
      `}</style>
      
      <div className="px-4 py-6 md:px-6 md:py-8 max-w-6xl mx-auto">
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

        <div>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}