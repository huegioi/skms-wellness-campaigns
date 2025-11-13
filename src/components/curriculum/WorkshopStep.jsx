import React from 'react';
import { productCatalog, challengeSolutionMap } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';
import { Sparkles } from 'lucide-react';

export default function WorkshopStep({ selections, updateSelections, onNext, onBack }) {
  const workshops = Object.entries(productCatalog.workshops);

  // Get suggested workshops based on selected challenges
  const getSuggestedWorkshops = () => {
    const suggested = new Set();
    (selections.challenges || []).forEach(challengeId => {
      const solutions = challengeSolutionMap[challengeId];
      if (solutions && solutions.workshops) {
        solutions.workshops.forEach(w => suggested.add(w));
      }
    });
    return Array.from(suggested);
  };

  const suggestedWorkshops = getSuggestedWorkshops();

  const toggleSelection = (key) => {
    const current = selections.workshops || [];
    if (current.includes(key)) {
      updateSelections('workshops', current.filter(k => k !== key));
    } else {
      updateSelections('workshops', [...current, key]);
    }
  };

  // Sort workshops: suggested first
  const sortedWorkshops = [...workshops].sort((a, b) => {
    const aIsSuggested = suggestedWorkshops.includes(a[0]);
    const bIsSuggested = suggestedWorkshops.includes(b[0]);
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
          background: linear-gradient(135deg, #eaf995, #cae5e3);
          color: #264d44;
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
          background: linear-gradient(135deg, rgba(202, 229, 227, 0.3), rgba(234, 249, 149, 0.3));
          border-left: 4px solid #264d44;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Select Workshops
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Choose the workshops that align with your team's needs. Each workshop is $1,500.
        </p>
      </div>

      {suggestedWorkshops.length > 0 && (
        <div className="suggestion-banner">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" style={{ color: '#264d44' }} />
            <h3 className="text-lg font-bold" style={{ color: '#264d44' }}>
              Recommended Based on Your Assessment
            </h3>
          </div>
          <p className="text-sm" style={{ color: '#555' }}>
            Based on the challenges you've identified, we recommend these workshops to address your specific needs.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {sortedWorkshops.map(([key, workshop]) => {
          const isSuggested = suggestedWorkshops.includes(key);
          return (
            <div key={key} style={{ position: 'relative' }}>
              {isSuggested && (
                <div className="suggested-badge">
                  <Sparkles className="w-3 h-3" />
                  Suggested
                </div>
              )}
              <SelectionCard
                title={workshop.name}
                description={workshop.description}
                price={workshop.price}
                icon={workshop.icon}
                isSelected={(selections.workshops || []).includes(key)}
                onToggle={() => toggleSelection(key)}
              />
            </div>
          );
        })}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Challenges"
      />
    </div>
  );
}