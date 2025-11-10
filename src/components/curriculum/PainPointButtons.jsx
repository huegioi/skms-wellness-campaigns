import React from 'react';

export default function PainPointButtons({ painPoints, selectedPainPoints, onToggle }) {
  return (
    <div className="mb-10">
      <style>{`
        .neuro-button {
          background: #e0e5e8;
          border: none;
          border-radius: 25px;
          padding: 12px 24px;
          font-size: 14px;
          color: #333;
          cursor: pointer;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.8);
          transition: all 0.2s ease;
          margin: 6px;
        }

        .neuro-button:hover {
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.15),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
        }

        .neuro-button.active {
          background: #441d37;
          color: white;
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.3),
            inset -4px -4px 8px rgba(255, 255, 255, 0.1);
        }

        .neuro-button:active {
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.2),
            inset -3px -3px 6px rgba(255, 255, 255, 0.1);
        }
      `}</style>
      
      <div className="flex flex-wrap justify-center">
        {painPoints.map(painPoint => (
          <button
            key={painPoint}
            className={`neuro-button ${selectedPainPoints.has(painPoint) ? 'active' : ''}`}
            onClick={() => onToggle(painPoint)}
          >
            {painPoint}
          </button>
        ))}
      </div>
    </div>
  );
}