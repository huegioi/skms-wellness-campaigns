import React from 'react';
import { Check } from 'lucide-react';

export default function StepIndicator({ steps, currentStep }) {
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
          font-size: 9px;
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
            
            return (
              <div key={step.number} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div 
                  className={`step-circle ${isCompleted ? 'completed' : ''}`}
                  style={{
                    background: isCompleted ? stepColor : 'white',
                    color: isCompleted ? 'white' : '#666'
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3 md:w-5 md:h-5" />
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