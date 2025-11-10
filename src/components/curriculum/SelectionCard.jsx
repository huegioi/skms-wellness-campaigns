import React from 'react';
import { Check } from 'lucide-react';

export default function SelectionCard({ title, description, price, isSelected, onToggle }) {
  return (
    <div>
      <style>{`
        .selection-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
          position: relative;
          border: 2px solid transparent;
        }

        .selection-card:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.15),
            -8px -8px 16px rgba(255, 255, 255, 0.95);
        }

        .selection-card.selected {
          border-color: #441d37;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.08),
            inset -3px -3px 6px rgba(255, 255, 255, 0.7);
        }

        .check-icon {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #441d37;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 
            3px 3px 6px rgba(0, 0, 0, 0.2),
            -3px -3px 6px rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <div 
        className={`selection-card ${isSelected ? 'selected' : ''}`}
        onClick={onToggle}
      >
        {isSelected && (
          <div className="check-icon">
            <Check className="w-4 h-4" />
          </div>
        )}
        <h3 className="text-lg font-bold mb-2 pr-8" style={{ color: '#013f7c' }}>
          {title}
        </h3>
        <p className="text-sm mb-3" style={{ color: '#666' }}>
          {description}
        </p>
        <div className="text-xl font-bold" style={{ color: '#441d37' }}>
          ${price.toLocaleString()}
        </div>
      </div>
    </div>
  );
}