import React from 'react';
import StepNavigation from './StepNavigation';

export default function CoachingStep({ selections, updateSelections, onNext, onBack }) {
  const coachingOptions = [
    { value: 'none', label: 'No Additional Coaching', description: 'Continue with workshops and challenges only' },
    { value: 'group', label: 'Group Coaching Sessions', description: 'Monthly group coaching for ongoing support (Contact for pricing)' },
    { value: 'individual', label: 'Individual Coaching', description: 'One-on-one coaching sessions for key team members (Contact for pricing)' },
    { value: 'hybrid', label: 'Hybrid Coaching', description: 'Combination of group and individual coaching (Contact for pricing)' }
  ];

  return (
    <div>
      <style>{`
        .coaching-option {
          background: #f4f0e9;
          border-radius: 12px;
          padding: 20px;
          cursor: pointer;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
          margin-bottom: 16px;
        }

        .coaching-option:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.15),
            -8px -8px 16px rgba(255, 255, 255, 0.95);
        }

        .coaching-option.selected {
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.1),
            inset -4px -4px 8px rgba(255, 255, 255, 0.8);
          border: 2px solid #441d37;
        }

        .coaching-radio {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #666;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .coaching-radio.selected {
          border-color: #441d37;
        }

        .coaching-radio.selected::after {
          content: '';
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #441d37;
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Ongoing Coaching Support
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Add coaching to sustain momentum and provide personalized guidance.
        </p>
      </div>

      <div className="mb-8">
        {coachingOptions.map((option) => (
          <div
            key={option.value}
            className={`coaching-option ${selections.coaching === option.value ? 'selected' : ''}`}
            onClick={() => updateSelections('coaching', option.value)}
          >
            <div className="flex items-start gap-4">
              <div className={`coaching-radio ${selections.coaching === option.value ? 'selected' : ''}`}></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: '#013f7c' }}>
                  {option.label}
                </h3>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  {option.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Wellness Boxes"
      />
    </div>
  );
}