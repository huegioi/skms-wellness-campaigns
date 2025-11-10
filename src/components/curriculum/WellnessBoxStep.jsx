import React from 'react';
import StepNavigation from './StepNavigation';

export default function WellnessBoxStep({ selections, updateSelections, onNext, onBack }) {
  const updateStepper = (type, increment) => {
    const currentValue = selections[type];
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);
    updateSelections(type, newValue);
  };

  return (
    <div>
      <style>{`
        .neuro-stepper {
          background: #f4f0e9;
          border-radius: 12px;
          padding: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.1),
            inset -3px -3px 6px rgba(255, 255, 255, 0.8);
        }

        .neuro-stepper-btn {
          background: #f4f0e9;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 20px;
          color: #441d37;
          font-weight: bold;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.12),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
        }

        .neuro-stepper-btn:hover {
          box-shadow: 
            3px 3px 6px rgba(0, 0, 0, 0.15),
            -3px -3px 6px rgba(255, 255, 255, 0.95);
        }

        .neuro-stepper-btn:active {
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.2),
            inset -2px -2px 4px rgba(255, 255, 255, 0.1);
        }

        .box-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Wellness Box Incentives
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Add wellness boxes to boost engagement and show appreciation for participation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Small Boxes */}
        <div className="box-card">
          <h3 className="text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Small Wellness Boxes
          </h3>
          <p className="text-sm mb-4" style={{ color: '#666' }}>
            Perfect for workshop participants and challenge completers
          </p>
          <div className="text-2xl font-bold mb-4" style={{ color: '#441d37' }}>
            $65 each
          </div>
          <div className="neuro-stepper">
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('smallBoxes', false)}
            >
              −
            </button>
            <span className="flex-1 text-center text-xl font-bold" style={{ color: '#333' }}>
              {selections.smallBoxes}
            </span>
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('smallBoxes', true)}
            >
              +
            </button>
          </div>
        </div>

        {/* Large Boxes */}
        <div className="box-card">
          <h3 className="text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Large Wellness Boxes
          </h3>
          <p className="text-sm mb-4" style={{ color: '#666' }}>
            Premium boxes for leadership teams and top performers
          </p>
          <div className="text-2xl font-bold mb-4" style={{ color: '#441d37' }}>
            $125 each
          </div>
          <div className="neuro-stepper">
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('largeBoxes', false)}
            >
              −
            </button>
            <span className="flex-1 text-center text-xl font-bold" style={{ color: '#333' }}>
              {selections.largeBoxes}
            </span>
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('largeBoxes', true)}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Review Your Campaign"
      />
    </div>
  );
}