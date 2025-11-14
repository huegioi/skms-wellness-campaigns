import React from 'react';
import { Check } from 'lucide-react';

export default function StepIndicator({ steps, currentStep }) {
  // Updated color palette for new step order
  const stepColors = [
    '#770142',  // Step 1 - Assessment (magenta)
    '#264d44',  // Step 2 - Workshops (teal)
    '#ff9878',  // Step 3 - Challenges (coral)
    '#eaf995',  // Step 4 - Wellness Boxes (yellow-green)
    '#cae5e3',  // Step 5 - Movement (light cyan)
    '#013f7c',  // Step 6 - Leadership (blue)
    '#441d37'   // Step 7 - Review (purple)
  ];

  return (
    <div className="mb-8 md:mb-12 px-2 md:px-4">
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
          background: linear-gradient(90deg, #770142, #264d44, #ff9878, #eaf995, #cae5e3, #013f7c, #441d37);
          z-index: 1;
          transition: width 0.3s ease;
        }

        .step-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f0e9;
          position: relative;
          z-index: 2;
          font-weight: 600;
          font-size: 13px;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.12),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
        }

        @media (min-width: 768px) {
          .step-circle {
            width: 40px;
            height: 40px;
            font-size: 14px;
          }
        }

        .step-circle.completed {
          color: white;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.2),
            inset -3px -3px 6px rgba(255, 255, 255, 0.1);
        }

        .step-label {
          font-size: 10px;
          color: #666;
          text-align: center;
          margin-top: 6px;
          font-weight: 500;
          line-height: 1.2;
          max-width: 70px;
        }

        @media (min-width: 768px) {
          .step-label {
            font-size: 12px;
            margin-top: 8px;
            max-width: none;
          }
        }
      `}</style>

      <div className="relative">
        <div className="step-line"></div>
        <div 
          className="step-progress" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        ></div>

        <div className="relative flex justify-between items-start">
          {steps.map((step, index) => {
            const stepColor = stepColors[index] || '#441d37';
            const isCompleted = step.number < currentStep;
            const isCurrent = step.number === currentStep;
            
            return (
              <div key={step.number} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div 
                  className={`step-circle ${isCompleted ? 'completed' : ''}`}
                  style={{
                    background: isCompleted ? stepColor : '#f4f0e9',
                    color: isCompleted ? 'white' : '#666'
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 md:w-5 md:h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <div 
                  className="step-label"
                  style={{ 
                    color: '#666',
                    fontWeight: isCurrent ? '700' : '500'
                  }}
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