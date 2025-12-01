import React from 'react';
import { productCatalog, challengeSolutionMap } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';
import { Sparkles } from 'lucide-react';

export default function ChallengeStep({ selections, updateSelections, onNext, onBack }) {
  const challenges = Object.entries(productCatalog.challenges);
  const assessmentData = selections.assessmentData || {};

  // Calculate challenge price based on company size
  const calculateChallengePrice = () => {
    const companySize = assessmentData.companySize || '';
    let employees = 0;
    let pricePerParticipant = 25;

    // Parse employee count from selection
    if (companySize === '1-50') {
      employees = 50;
      pricePerParticipant = 25;
    } else if (companySize === '51-200') {
      employees = 100;
      pricePerParticipant = 22;
    } else if (companySize === '201-500') {
      employees = 200;
      pricePerParticipant = 20;
    } else if (companySize === '501-1000') {
      employees = 500;
      pricePerParticipant = 20;
    } else if (companySize === '1001-5000') {
      employees = 1000;
      pricePerParticipant = 20;
    } else if (companySize === '5000+') {
      employees = 5000;
      pricePerParticipant = 20;
    } else {
      // Default if no size selected
      return 1500;
    }

    // 30% of employees * price per participant
    const participants = Math.ceil(employees * 0.30);
    return participants * pricePerParticipant;
  };

  const challengePrice = calculateChallengePrice();

  // Get suggested challenges based on:
  // 1. Selected workforce challenges from assessment
  // 2. Selected workshops (to reinforce their concepts)
  const getSuggestedChallenges = () => {
    const suggested = new Set();
    
    // From assessment challenges
    (selections.challenges || []).forEach(challengeId => {
      const solutions = challengeSolutionMap[challengeId];
      if (solutions && solutions.challenges) {
        solutions.challenges.forEach(c => suggested.add(c));
      }
    });

    // From selected workshops - map workshops to challenges that reinforce them
    const workshopToChallengeMap = {
      mindsetMastery: ['emotionalResilience'],
      beyondBurnout: ['emotionalResilience', 'calmConfident'],
      navigatingConversations: ['clearCommunication'],
      mindfulnessStress: ['calmConfident'],
      positiveMinds: ['compassionateColleague'],
      creatingConnections: ['creatingConnections'],
      fosteringWellBeing: ['compassionateColleague']
    };

    (selections.workshops || []).forEach(workshopKey => {
      const relatedChallenges = workshopToChallengeMap[workshopKey];
      if (relatedChallenges) {
        relatedChallenges.forEach(c => suggested.add(c));
      }
    });

    return Array.from(suggested);
  };

  const suggestedChallenges = getSuggestedChallenges();

  const toggleSelection = (key) => {
    const current = selections.challengePrograms || [];
    if (current.includes(key)) {
      updateSelections('challengePrograms', current.filter(k => k !== key));
    } else {
      updateSelections('challengePrograms', [...current, key]);
    }
  };

  // Sort challenges: suggested first
  const sortedChallenges = [...challenges].sort((a, b) => {
    const aIsSuggested = suggestedChallenges.includes(a[0]);
    const bIsSuggested = suggestedChallenges.includes(b[0]);
    if (aIsSuggested && !bIsSuggested) return -1;
    if (!aIsSuggested && bIsSuggested) return 1;
    return 0;
  });

  return (
    <div>
      <style>{`
        .suggested-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: linear-gradient(135deg, #ff9878, #ff6b4a);
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 10;
        }

        .suggestion-banner {
          background: linear-gradient(135deg, rgba(255, 152, 120, 0.2), rgba(255, 107, 74, 0.2));
          border-left: 4px solid #ff9878;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Add 14-Day Challenges
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Challenges provide ongoing engagement and help reinforce workshop concepts. 
          {assessmentData.companySize ? (
            <> Based on your organization size, each challenge is <strong>${challengePrice.toLocaleString()}</strong>.</>
          ) : (
            <> Select your company size in the Assessment step for accurate pricing.</>
          )}
        </p>
      </div>

      {suggestedChallenges.length > 0 && (
        <div className="suggestion-banner">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" style={{ color: '#ff9878' }} />
            <h3 className="text-lg font-bold" style={{ color: '#ff9878' }}>
              Recommended to Reinforce Your Workshops
            </h3>
          </div>
          <p className="text-sm" style={{ color: '#555' }}>
            These challenges are designed to build on the skills and concepts introduced in your selected workshops, creating lasting behavioral change.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {sortedChallenges.map(([key, challenge]) => {
          const isSuggested = suggestedChallenges.includes(key);
          return (
            <div key={key} style={{ position: 'relative' }}>
              {isSuggested && (
                <div className="suggested-badge">
                  <Sparkles className="w-3 h-3" />
                  Builds on Workshops
                </div>
              )}
              <SelectionCard
                title={challenge.name}
                description={challenge.description}
                price={challengePrice}
                icon={challenge.icon}
                badge={challenge.duration}
                isSelected={(selections.challengePrograms || []).includes(key)}
                onToggle={() => toggleSelection(key)}
              />
            </div>
          );
        })}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Wellness Boxes"
      />
    </div>
  );
}