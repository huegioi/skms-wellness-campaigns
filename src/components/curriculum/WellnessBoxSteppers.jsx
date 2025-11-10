import React from 'react';

export default function WellnessBoxSteppers({ stepperValues, onUpdate }) {
  return (
    <div className="mb-10">
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
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
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

        .neuro-stepper-value {
          min-width: 40px;
          text-align: center;
          font-weight: 600;
          color: #333;
        }
      `}</style>

      <h3 className="text-xl font-bold mb-5 text-center" style={{ color: '#013f7c' }}>
        Wellness Box Incentives
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
        <div>
          <label className="block mb-2 font-semibold" style={{ color: '#555' }}>
            Small Boxes ($65 ea)
          </label>
          <div className="neuro-stepper">
            <button 
              className="neuro-stepper-btn"
              onClick={() => onUpdate('small', false)}
            >
              −
            </button>
            <span className="neuro-stepper-value">{stepperValues.small}</span>
            <button 
              className="neuro-stepper-btn"
              onClick={() => onUpdate('small', true)}
            >
              +
            </button>
          </div>
        </div>
        <div>
          <label className="block mb-2 font-semibold" style={{ color: '#555' }}>
            Large Boxes ($125 ea)
          </label>
          <div className="neuro-stepper">
            <button 
              className="neuro-stepper-btn"
              onClick={() => onUpdate('large', false)}
            >
              −
            </button>
            <span className="neuro-stepper-value">{stepperValues.large}</span>
            <button 
              className="neuro-stepper-btn"
              onClick={() => onUpdate('large', true)}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}