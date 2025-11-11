import React from 'react';
import { productCatalog } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';

export default function WorkshopStep({ selections, updateSelections, onNext, onBack }) {
  const workshops = Object.entries(productCatalog.workshops);

  const toggleSelection = (key) => {
    const current = selections.workshops;
    if (current.includes(key)) {
      updateSelections('workshops', current.filter(k => k !== key));
    } else {
      updateSelections('workshops', [...current, key]);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Select Workshops
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Choose the workshops that align with your team's needs. Each workshop is $1,500.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {workshops.map(([key, workshop]) => (
          <SelectionCard
            key={key}
            title={workshop.name}
            description={workshop.description}
            price={workshop.price}
            icon={workshop.icon}
            isSelected={selections.workshops.includes(key)}
            onToggle={() => toggleSelection(key)}
          />
        ))}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Challenges"
      />
    </div>
  );
}