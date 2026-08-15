import React from 'react';
import { Check } from 'lucide-react';

export default function StepIndicator({ steps, currentStep, onStepClick, contentSteps = [] }) {
  const stepColors = [
    '#770142',  
    '#264d44',  
    '#ff9878',  
    '#eaf995',  
    '#cae5e3',  
    '#013f7c',  
    '#441d37'   
  ];

  return (
    <div className="mb-6 md:mb-12 px-1 md:px-4">
      <style>{`
        .step-line {
          position: absolute;
          top: 16px;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(0, 0, 0, 0.1);
          z-index: 0;
        }

        @media (min-width: 768px) {
          .step-line {
            top: 20px;
          }
        }

        .step-progress {
          position: absolute;
          top: 16px;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, #770142, #264d44, #ff9878, #eaf995, #cae5e3, #013f7c, #441d37);
          z-index: 1;
          transition: width 0.3s ease;
        }

        @media (min-width: 768px) {
          .step-progress {
            top: 20px;
          }
        }

        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          position: relative;
          z-index: 2;
          font-weight: 600;
          font-size: 11px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
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
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .step-label {
          font-size: 11px;
          color: #666;
          text-align: center;
          margin-top: 4px;
          font-weight: 500;
          line-height: 1.1;
          max-width: 60px;
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
            const hasContent = contentSteps.includes(step.number);

            const isClickable = onStepClick && (isCompleted || isCurrent);
            return (
              <div
                key={step.number}
                className="flex flex-col items-center"
                style={{ flex: 1, cursor: isClickable ? 'pointer' : 'default' }}
                onClick={() => isClickable && onStepClick(step.number)}
                title={isClickable ? `Go to ${step.name}` : ''}
              >
                <div 
                  className={`step-circle ${isCompleted ? 'completed' : ''}`}
                  style={{
                    background: isCompleted ? stepColor : isCurrent ? `${stepColor}22` : 'white',
                    color: isCompleted ? 'white' : isCurrent ? stepColor : '#666',
                    border: isCurrent ? `2px solid ${stepColor}` : '2px solid transparent',
                    transform: isClickable ? 'scale(1)' : undefined,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={e => { if (isClickable) e.currentTarget.style.transform = 'scale(1.15)'; }}
                  onMouseLeave={e => { if (isClickable) e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3 md:w-5 md:h-5" />
                  ) : (
                    step.number
                  )}
                  {hasContent && !isCompleted && (
                    <span
                      title="Has selections"
                      style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 10, height: 10, borderRadius: '50%',
                        background: '#264d44', border: '2px solid white',
                      }}
                    />
                  )}
                </div>
                <div 
                  className="step-label"
                  style={{ 
                    color: isCurrent ? stepColor : '#666',
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