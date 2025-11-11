import React from 'react';
import { productCatalog } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';

export default function ChallengeStep({ selections, updateSelections, onNext, onBack }) {
  const challenges = Object.entries(productCatalog.challenges);

  const toggleSelection = (key) => {
    const current = selections.challengePrograms || [];
    if (current.includes(key)) {
      updateSelections('challengePrograms', current.filter(k => k !== key));
    } else {
      updateSelections('challengePrograms', [...current, key]);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Add 14-Day Challenges
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Challenges provide ongoing engagement and help reinforce workshop concepts. Each challenge is $1,500.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {challenges.map(([key, challenge]) => (
          <SelectionCard
            key={key}
            title={challenge.name}
            description={challenge.description}
            price={challenge.price}
            icon={challenge.icon}
            badge={challenge.duration}
            isSelected={(selections.challengePrograms || []).includes(key)}
            onToggle={() => toggleSelection(key)}
          />
        ))}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Leadership"
      />
    </div>
  );
}