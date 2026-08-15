import React from 'react';
import { productCatalog, challengeSolutionMap } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';
import { resolveStaticKeys } from '@/lib/catalogServiceResolver';
import { Sparkles } from 'lucide-react';

export default function LeadershipStep({ selections, updateSelections, onNext, onBack, catalogServices }) {
  // Only use active services from catalog — no static fallback
  const leadership = (catalogServices || []).map(s => [
    s.id,
    { name: s.name, description: s.short_description || s.description, price: s.price, icon: 'Crown', image: s.images?.[0]?.url }
  ]);

  // Suggested programs from the assessment's workforce challenges, resolved
  // from static catalog keys to live Service IDs by name.
  const suggestedLeadership = (() => {
    const staticKeys = new Set();
    (selections.challenges || []).forEach(challengeId => {
      const solutions = challengeSolutionMap[challengeId];
      if (solutions && solutions.leadership) solutions.leadership.forEach(l => staticKeys.add(l));
    });
    return resolveStaticKeys(Array.from(staticKeys), 'leadership', catalogServices);
  })();

  const sortedLeadership = [...leadership].sort((a, b) => {
    const aS = suggestedLeadership.includes(a[0]);
    const bS = suggestedLeadership.includes(b[0]);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return 0;
  });

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

      {suggestedLeadership.length > 0 && (
        <div className="mb-6 rounded-xl border-l-4 px-4 py-3" style={{ borderColor: '#264d44', background: 'rgba(202,229,227,0.25)' }}>
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: '#264d44' }}>
            <Sparkles className="w-4 h-4" /> Suggested for the challenges you identified — shown first
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {sortedLeadership.map(([key, program]) => (
          <div key={key} style={{ position: 'relative' }}>
            {suggestedLeadership.includes(key) && (
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
              title={program.name}
              description={program.description}
              price={program.price}
              icon={program.icon}
              image={program.image}
              isSelected={(selections.leadership || []).includes(key)}
              onToggle={() => toggleSelection(key)}
            />
          </div>
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