import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function StepNavigation({ onNext, onBack, isFirstStep, isLastStep, nextLabel = 'Continue', disabled = false }) {
  return (
    <div>
      <style>{`
        .nav-button {
          background: #f4f0e9;
          border: none;
          border-radius: 12px;
          padding: 14px 28px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
          color: #013f7c;
        }

        .nav-button:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.15),
            -8px -8px 16px rgba(255, 255, 255, 0.95);
        }

        .nav-button:active {
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.12),
            inset -4px -4px 8px rgba(255, 255, 255, 0.8);
        }

        .nav-button.primary {
          background: #441d37;
          color: white;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.2),
            -6px -6px 12px rgba(255, 255, 255, 0.1);
        }

        .nav-button.primary:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.25),
            -8px -8px 16px rgba(255, 255, 255, 0.15);
        }

        .nav-button.primary:active {
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.3),
            inset -4px -4px 8px rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <div className="flex justify-between items-center">
        {!isFirstStep ? (
          <button type="button" className="nav-button" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        ) : (
          <div></div>
        )}

        <button 
          type="button" 
          className="nav-button primary" 
          onClick={onNext}
          disabled={disabled}
          style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {nextLabel}
          {!isLastStep && <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}