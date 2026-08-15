import React from 'react';
import { productCatalog, challengeSolutionMap } from './catalogData';
import SelectionCard from './SelectionCard';
import StepNavigation from './StepNavigation';
import { resolveStaticKeys } from '@/lib/catalogServiceResolver';
import { workshopTopicPrice, sessionsPerWorkshop, CAMPAIGN_STAGES } from '@/lib/rateCard';
import { Sparkles, Snowflake } from 'lucide-react';

export default function WorkshopStep({ selections, updateSelections, onNext, onBack, catalogServices }) {
  // Workshop price comes from the RATE CARD at this headcount, never from
  // Service.price — a topic is $1,500 at 200 employees and $5,100 at 4,000,
  // so one stored number can only ever be wrong for someone.
  const employees = parseInt(selections.assessmentData?.companySize || '0', 10) || 0;
  const topicPrice = employees > 0 ? workshopTopicPrice(employees) : null;
  const sections = employees > 0 ? sessionsPerWorkshop(employees) : 1;

  // Only use active services from catalog — no static fallback
  const workshops = (catalogServices || []).map(s => [
    s.id,
    { name: s.name, description: s.short_description || s.description, price: topicPrice ?? undefined, icon: 'Award', seasonal: false, image: s.images?.[0]?.url }
  ]);

  // The stage chosen on the Impact step sets how many workshops the campaign
  // includes — surface that here so selections stay tied to the stage.
  const chosenStage = CAMPAIGN_STAGES.find(s => s.stage === selections.impact?.stageNum);
  const pickedCount = (selections.workshops || []).length;

  // Suggested workshops from the assessment's workforce challenges.
  // challengeSolutionMap speaks static catalog keys; the cards are keyed by
  // live Service IDs, so resolve by name before comparing — an unresolved
  // static key would otherwise never match anything.
  const getSuggestedWorkshops = () => {
    const staticKeys = new Set();
    (selections.challenges || []).forEach(challengeId => {
      const solutions = challengeSolutionMap[challengeId];
      if (solutions && solutions.workshops) {
        solutions.workshops.forEach(w => staticKeys.add(w));
      }
    });
    return resolveStaticKeys(Array.from(staticKeys), 'workshop', catalogServices);
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

        .seasonal-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: linear-gradient(135deg, #a8d8ea, #e8f4f8);
          color: #1a5276;
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
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Select Workshops
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Choose the workshops that align with your team's needs.
          {topicPrice != null && (
            <> Each topic is ${topicPrice.toLocaleString()} for your {employees.toLocaleString()} employees
            {sections > 1 ? ` — all ${sections} sections included` : ''}.</>
          )}
        </p>
      </div>

      {chosenStage && (
        <div className="mb-6 rounded-xl border border-[#013f7c]/20 bg-[#013f7c]/[0.04] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-[#013f7c]">
            {chosenStage.name} includes {chosenStage.workshops} workshop{chosenStage.workshops !== 1 ? 's' : ''} — you've selected {pickedCount}
          </p>
          {pickedCount > chosenStage.workshops && (
            <p className="text-xs text-gray-500">
              Extra topics beyond the stage are quoted à la carte on the review step.
            </p>
          )}
        </div>
      )}

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
          const isSeasonal = workshop.seasonal;
          return (
            <div key={key} style={{ position: 'relative' }}>
              {isSeasonal && !isSuggested && (
                <div className="seasonal-badge">
                  <Snowflake className="w-3 h-3" />
                  Seasonal
                </div>
              )}
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
                image={workshop.image}
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