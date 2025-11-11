import React from 'react';
import { productCatalog } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';

export default function MovementStep({ selections, updateSelections, onNext, onBack }) {
  const classes = Object.entries(productCatalog.movementClasses);

  const toggleSelection = (key) => {
    const current = selections.movementClasses;
    if (current.includes(key)) {
      updateSelections('movementClasses', current.filter(k => k !== key));
    } else {
      updateSelections('movementClasses', [...current, key]);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Movement & Mindfulness Classes
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Add ongoing movement and mindfulness classes to support physical and mental well-being.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {classes.map(([key, classInfo]) => (
          <SelectionCard
            key={key}
            title={classInfo.name}
            description={classInfo.description}
            price={classInfo.price}
            icon={classInfo.icon}
            badge={classInfo.duration}
            isSelected={selections.movementClasses.includes(key)}
            onToggle={() => toggleSelection(key)}
          />
        ))}
      </div>

      <div className="text-center my-8">
        <button
          onClick={onNext}
          className="text-sm font-semibold"
          style={{ color: '#013f7c', textDecoration: 'underline' }}
        >
          Skip Movement Classes
        </button>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Wellness Boxes"
      />
    </div>
  );
}