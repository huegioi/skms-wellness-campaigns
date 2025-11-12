import React from 'react';
import { Check } from 'lucide-react';

export default function StepIndicator({ steps, currentStep }) {
  // Color palette for steps
  const stepColors = [
    '#770142', // Step 1 - Assessment (magenta)
    '#264d44', // Step 2 - Workshops (teal)
    '#ff9878', // Step 3 - Challenges (coral)
    '#013f7c', // Step 4 - Leadership (blue)
    '#cae5e3', // Step 5 - Movement (light cyan)
    '#eaf995', // Step 6 - Wellness (yellow-green)
    '#441d37'  // Step 7 - Review (purple)
  ];

  return (
    <div className="mb-12">
      <style>{`
        .step-line {
          position: absolute;
          top: 20px;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(0, 0, 0, 0.1);
          z-index: 0;
        }

        .step-progress {
          position: absolute;
          top: 20px;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, #770142, #264d44, #ff9878, #013f7c, #cae5e3, #eaf995, #441d37);
          z-index: 1;
          transition: width 0.3s ease;
        }

        .step-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f0e9;
          position: relative;
          z-index: 2;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.12),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
        }

        .step-circle.active {
          color: white;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.2),
            -6px -6px 12px rgba(255, 255, 255, 0.1);
        }

        .step-circle.completed {
          color: white;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.2),
            inset -3px -3px 6px rgba(255, 255, 255, 0.1);
        }

        .step-label {
          font-size: 12px;
          color: #666;
          text-align: center;
          margin-top: 8px;
          font-weight: 500;
        }

        .step-label.active {
          font-weight: 700;
        }
      `}</style>

      <div className="relative px-4">
        <div className="step-line"></div>
        <div 
          className="step-progress" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        ></div>

        <div className="relative flex justify-between items-start">
          {steps.map((step, index) => {
            const stepColor = stepColors[index] || '#441d37';
            return (
              <div key={step.number} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div 
                  className={`step-circle ${
                    step.number === currentStep ? 'active' : 
                    step.number < currentStep ? 'completed' : ''
                  }`}
                  style={{
                    background: step.number <= currentStep ? stepColor : '#f4f0e9',
                    color: step.number <= currentStep ? 'white' : stepColor
                  }}
                >
                  {step.number < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <div 
                  className={`step-label ${step.number === currentStep ? 'active' : ''}`}
                  style={{ color: step.number === currentStep ? stepColor : '#666' }}
                >
                  {step.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}