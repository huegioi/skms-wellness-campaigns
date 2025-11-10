import React from 'react';
import { productCatalog } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';

export default function ChallengeStep({ selections, updateSelections, onNext, onBack }) {
  const challenges = Object.entries(productCatalog.challenges);

  const toggleSelection = (key) => {
    const current = selections.challenges;
    if (current.includes(key)) {
      updateSelections('challenges', current.filter(k => k !== key));
    } else {
      updateSelections('challenges', [...current, key]);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Add Challenges
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Challenges provide ongoing engagement and help reinforce workshop concepts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {challenges.map(([key, challenge]) => (
          <SelectionCard
            key={key}
            title={challenge.name}
            description={challenge.description}
            price={challenge.price}
            isSelected={selections.challenges.includes(key)}
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