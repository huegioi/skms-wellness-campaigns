import React from 'react';
import { productCatalog, challengeSolutionMap } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';
import { Sparkles } from 'lucide-react';
import ChallengePricingEstimator, { calcPricing } from './ChallengePricingEstimator';

export default function ChallengeStep({ selections, updateSelections, onNext, onBack, catalogServices }) {
  // Only use active services from catalog — no static fallback
  const challenges = (catalogServices || []).map(s => [
    s.id,
    { name: s.name, description: s.short_description || s.description, price: s.price, icon: 'Flame', duration: s.duration || '14 days', image: s.images?.[0]?.url }
  ]);
  const assessmentData = selections.assessmentData || {};

  // Use the canonical pricing logic
  const employees = parseInt(assessmentData.companySize || '0', 10);
  const pricing = calcPricing(employees);
  const challengePrice = pricing ? pricing.totalCost : null;

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

      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Add 14-Day Challenges
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Challenges provide ongoing engagement and help reinforce workshop concepts.
        </p>
      </div>

      <ChallengePricingEstimator initialHeadcount={employees > 0 ? employees : undefined} />

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
                price={challengePrice !== null ? challengePrice : challenge.price}
                icon={challenge.icon}
                image={challenge.image}
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
        nextLabel="Continue to Classes"
      />
    </div>
  );
}