import React from 'react';
import { productCatalog, challengeSolutionMap } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';
import { resolveStaticKeys } from '@/lib/catalogServiceResolver';
import { Sparkles } from 'lucide-react';

export default function MovementStep({ selections, updateSelections, onNext, onBack, catalogServices }) {
  // Only use active services from catalog — no static fallback
  const movementClasses = (catalogServices || []).map(s => [
    s.id,
    { name: s.name, description: s.short_description || s.description, price: s.price, icon: 'Activity', image: s.images?.[0]?.url }
  ]);

  // Suggested classes from the assessment's workforce challenges, resolved
  // from static catalog keys to live Service IDs by name.
  const suggestedClasses = (() => {
    const staticKeys = new Set();
    (selections.challenges || []).forEach(challengeId => {
      const solutions = challengeSolutionMap[challengeId];
      if (solutions && solutions.classes) solutions.classes.forEach(c => staticKeys.add(c));
    });
    return resolveStaticKeys(Array.from(staticKeys), 'class', catalogServices);
  })();

  const sortedClasses = [...movementClasses].sort((a, b) => {
    const aS = suggestedClasses.includes(a[0]);
    const bS = suggestedClasses.includes(b[0]);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return 0;
  });

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

      {suggestedClasses.length > 0 && (
        <div className="mb-6 rounded-xl border-l-4 px-4 py-3" style={{ borderColor: '#264d44', background: 'rgba(202,229,227,0.25)' }}>
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#264d44' }}>
            <Sparkles className="w-4 h-4" /> Suggested for the challenges you identified — shown first
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {sortedClasses.map(([key, classItem]) => (
          <div key={key} style={{ position: 'relative' }}>
            {suggestedClasses.includes(key) && (
              <div style={{
                position: 'absolute', top: -8, right: -8, zIndex: 10,
                background: 'linear-gradient(135deg, #eaf995, #cae5e3)', color: '#264d44',
                padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Sparkles style={{ width: 12, height: 12 }} /> Suggested
              </div>
            )}
            <SelectionCard
              title={classItem.name}
              description={classItem.description}
              price={classItem.price}
              icon={classItem.icon}
              image={classItem.image}
              isSelected={(selections.movementClasses || []).includes(key)}
              onToggle={() => toggleSelection(key)}
            />
          </div>
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
        nextLabel="Continue to Leadership Programs"
      />
    </div>
  );
}