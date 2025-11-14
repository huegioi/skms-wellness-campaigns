import React from 'react';
import { productCatalog } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';

export default function MovementStep({ selections, updateSelections, onNext, onBack }) {
  const movementClasses = Object.entries(productCatalog.movementClasses);

  const toggleSelection = (key) => {
    const current = selections.movementClasses || [];
    if (current.includes(key)) {
      updateSelections('movementClasses', current.filter(k => k !== key));
    } else {
      updateSelections('movementClasses', [...current, key]);
    }
  };

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Classes
        </h2>
        <p className="text-base md:text-lg" style={{ color: '#666' }}>
          Ongoing movement and mindfulness classes to sustain wellness habits and build community.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {movementClasses.map(([key, classItem]) => (
          <SelectionCard
            key={key}
            title={classItem.name}
            description={classItem.description}
            price={classItem.price}
            icon={classItem.icon}
            isSelected={(selections.movementClasses || []).includes(key)}
            onToggle={() => toggleSelection(key)}
          />
        ))}
      </div>

      <div className="text-center my-6 md:my-8">
        <button
          onClick={onNext}
          className="text-sm font-semibold"
          style={{ color: '#013f7c', textDecoration: 'underline' }}
        >
          Skip Classes
        </button>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Leadership"
      />
    </div>
  );
}