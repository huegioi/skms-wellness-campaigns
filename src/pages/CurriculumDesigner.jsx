import React, { useState } from 'react';
import StepIndicator from '../components/curriculum/StepIndicator';
import AssessmentStep from '../components/curriculum/AssessmentStep';
import WorkshopStep from '../components/curriculum/WorkshopStep';
import ChallengeStep from '../components/curriculum/ChallengeStep';
import LeadershipStep from '../components/curriculum/LeadershipStep';
import MovementStep from '../components/curriculum/MovementStep';
import WellnessBoxStep from '../components/curriculum/WellnessBoxStep';
import ReviewStep from '../components/curriculum/ReviewStep';

export default function CurriculumDesigner() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selections, setSelections] = useState({
    challenges: [],
    workshops: [],
    challengePrograms: [],
    leadership: [],
    movementClasses: [],
    smallBoxes: 0,
    largeBoxes: 0
  });

  const steps = [
    { number: 1, name: 'Assessment', component: AssessmentStep },
    { number: 2, name: 'Workshops', component: WorkshopStep },
    { number: 3, name: 'Challenges', component: ChallengeStep },
    { number: 4, name: 'Leadership', component: LeadershipStep },
    { number: 5, name: 'Movement', component: MovementStep },
    { number: 6, name: 'Wellness Boxes', component: WellnessBoxStep },
    { number: 7, name: 'Review', component: ReviewStep }
  ];

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

  const updateSelections = (category, value) => {
    setSelections(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#f4f0e9' }}>
      <div className="max-w-5xl mx-auto">
        <style>{`
          .neuro-container {
            background: #f4f0e9;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 
              12px 12px 24px rgba(0, 0, 0, 0.15),
              -12px -12px 24px rgba(255, 255, 255, 0.9);
          }
        `}</style>

        <div className="neuro-container">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: '#013f7c' }}>
              Build Your Mental Fitness Campaign
            </h1>
            <p className="text-base md:text-lg" style={{ color: '#666' }}>
              Create a customized wellness journey for your organization
            </p>
          </div>

          {/* Step Indicator */}
          <StepIndicator steps={steps} currentStep={currentStep} />

          {/* Current Step Content */}
          <CurrentStepComponent
            selections={selections}
            updateSelections={updateSelections}
            onNext={handleNext}
            onBack={handleBack}
            isFirstStep={currentStep === 1}
            isLastStep={currentStep === steps.length}
          />
        </div>
      </div>
    </div>
  );
}