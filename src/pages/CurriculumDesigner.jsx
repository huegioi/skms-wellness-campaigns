import React, { useState, useEffect } from 'react';
import PainPointButtons from '../components/curriculum/PainPointButtons';
import WellnessBoxSteppers from '../components/curriculum/WellnessBoxSteppers';
import PlanCard from '../components/curriculum/PlanCard';
import SubmissionForm from '../components/curriculum/SubmissionForm';
import { productCatalog, painPointData } from '../components/curriculum/catalogData';

export default function CurriculumDesigner() {
  const [selectedPainPoints, setSelectedPainPoints] = useState(new Set());
  const [stepperValues, setStepperValues] = useState({ small: 0, large: 0 });
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planConfigs, setPlanConfigs] = useState({
    campaign: { workshops: [], challenges: [], coaching: [], includePlatform: false, includeReporting: false },
    community: { workshops: [], challenges: [], coaching: [], includePlatform: true, includeReporting: false },
    coaching: { workshops: [], challenges: [], coaching: [], includePlatform: true, includeReporting: true }
  });

  // Toggle pain point selection
  const togglePainPoint = (painPoint) => {
    setSelectedPainPoints(prev => {
      const newSet = new Set(prev);
      if (newSet.has(painPoint)) {
        newSet.delete(painPoint);
      } else {
        newSet.add(painPoint);
      }
      return newSet;
    });
  };

  // Update stepper values
  const updateStepper = (type, increment) => {
    setStepperValues(prev => ({
      ...prev,
      [type]: increment ? prev[type] + 1 : Math.max(0, prev[type] - 1)
    }));
  };

  // Get all products for selected pain points
  const getSelectedProducts = () => {
    const products = { workshops: [], challenges: [], coaching: [] };
    
    selectedPainPoints.forEach(painPoint => {
      const data = painPointData[painPoint];
      if (data.workshops) {
        products.workshops.push(...data.workshops);
      }
      if (data.challenges) {
        products.challenges.push(...data.challenges);
      }
      if (data.coaching) {
        products.coaching.push(...data.coaching);
      }
    });

    // Remove duplicates
    products.workshops = [...new Set(products.workshops)];
    products.challenges = [...new Set(products.challenges)];
    products.coaching = [...new Set(products.coaching)];

    return products;
  };

  // Update recommendations when pain points or steppers change
  useEffect(() => {
    const products = getSelectedProducts();
    
    setPlanConfigs({
      campaign: {
        workshops: products.workshops.slice(0, 2),
        challenges: products.challenges.slice(0, 1),
        coaching: [],
        includePlatform: false,
        includeReporting: false
      },
      community: {
        workshops: products.workshops.slice(0, 4),
        challenges: products.challenges.slice(0, 2),
        coaching: [],
        includePlatform: true,
        includeReporting: false
      },
      coaching: {
        workshops: products.workshops,
        challenges: products.challenges,
        coaching: products.coaching,
        includePlatform: true,
        includeReporting: true
      }
    });

    // Highlight best plan
    if (selectedPainPoints.has('Leadership Development')) {
      setSelectedPlan('coaching');
    } else if (selectedPainPoints.size > 0) {
      setSelectedPlan('community');
    } else {
      setSelectedPlan('');
    }
  }, [selectedPainPoints, stepperValues]);

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#e0e5e8' }}>
      <div className="max-w-7xl mx-auto">
        {/* Custom Styles */}
        <style>{`
          .neuro-container {
            background: #e0e5e8;
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
              Start Your Curriculum Design
            </h1>
            <p className="text-base md:text-lg" style={{ color: '#666' }}>
              Your Organizational Pain Points
            </p>
          </div>

          {/* Pain Point Buttons */}
          <PainPointButtons 
            painPoints={Object.keys(painPointData)}
            selectedPainPoints={selectedPainPoints}
            onToggle={togglePainPoint}
          />

          {/* Wellness Box Incentives */}
          <WellnessBoxSteppers 
            stepperValues={stepperValues}
            onUpdate={updateStepper}
          />

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <PlanCard 
              planType="campaign"
              title="Campaign"
              tag="Starter Pack"
              tagColor="starter"
              config={planConfigs.campaign}
              stepperValues={stepperValues}
              isHighlighted={selectedPlan === 'campaign'}
            />
            <PlanCard 
              planType="community"
              title="Community"
              tag="Best Value"
              tagColor="best"
              config={planConfigs.community}
              stepperValues={stepperValues}
              isHighlighted={selectedPlan === 'community'}
            />
            <PlanCard 
              planType="coaching"
              title="Coaching"
              tag="Highest Rated"
              tagColor="highest"
              config={planConfigs.coaching}
              stepperValues={stepperValues}
              isHighlighted={selectedPlan === 'coaching'}
            />
          </div>

          {/* Submission Form */}
          <SubmissionForm 
            selectedPainPoints={selectedPainPoints}
            selectedPlan={selectedPlan}
            planConfigs={planConfigs}
            stepperValues={stepperValues}
          />
        </div>
      </div>
    </div>
  );
}