import React from 'react';
import { workforceChallenges } from './catalogData';
import StepNavigation from './StepNavigation';
import * as Icons from 'lucide-react';

export default function AssessmentStep({ selections, updateSelections, onNext, isFirstStep }) {
  const toggleChallenge = (challengeId) => {
    const current = selections.challenges || [];
    if (current.includes(challengeId)) {
      updateSelections('challenges', current.filter(id => id !== challengeId));
    } else {
      updateSelections('challenges', [...current, challengeId]);
    }
  };

  return (
    <div>
      <style>{`
        .challenge-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
          border: 2px solid transparent;
          position: relative;
        }

        .challenge-card:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.15),
            -8px -8px 16px rgba(255, 255, 255, 0.95);
        }

        .challenge-card.selected {
          border-color: #441d37;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.08),
            inset -3px -3px 6px rgba(255, 255, 255, 0.7);
        }

        .icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #441d37 0%, #5a2747 100%);
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.15),
            -2px -2px 6px rgba(255, 255, 255, 0.1);
          margin-bottom: 12px;
        }

        .check-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #441d37;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 
            2px 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Workforce Assessment
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          What challenges is your workforce currently facing? Select all that apply.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {workforceChallenges.map((challenge) => {
          const IconComponent = Icons[challenge.icon];
          const isSelected = (selections.challenges || []).includes(challenge.id);
          
          return (
            <div
              key={challenge.id}
              className={`challenge-card ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleChallenge(challenge.id)}
            >
              {isSelected && (
                <div className="check-badge">
                  <Icons.Check className="w-4 h-4" />
                </div>
              )}
              <div className="icon-wrapper">
                {IconComponent && <IconComponent className="w-6 h-6 text-white" />}
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#013f7c' }}>
                {challenge.label}
              </h3>
              <p className="text-sm" style={{ color: '#666' }}>
                {challenge.description}
              </p>
            </div>
          );
        })}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={() => {}}
        isFirstStep={isFirstStep}
        nextLabel="Continue to Workshops"
      />
    </div>
  );
}