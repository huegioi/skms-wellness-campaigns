import React from 'react';
import { productCatalog } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';

export default function LeadershipStep({ selections, updateSelections, onNext, onBack, catalogServices }) {
  // Only use active services from catalog — no static fallback
  const leadership = (catalogServices || []).map(s => [
    s.id,
    { name: s.name, description: s.short_description || s.description, price: s.price, icon: 'Crown', image: s.images?.[0]?.url }
  ]);

  const toggleSelection = (key) => {
    const current = selections.leadership || [];
    if (current.includes(key)) {
      updateSelections('leadership', current.filter(k => k !== key));
    } else {
      updateSelections('leadership', [...current, key]);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Leadership Development
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Elevate your leaders with specialized emotional intelligence training and coaching programs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {leadership.map(([key, program]) => (
          <SelectionCard
            key={key}
            title={program.name}
            description={program.description}
            price={program.price}
            icon={program.icon}
            image={program.image}
            isSelected={(selections.leadership || []).includes(key)}
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
          Skip Leadership Training
        </button>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Incentives"
      />
    </div>
  );
}