import React from 'react';
import { productCatalog } from './catalogData';

export default function PlanCard({ planType, title, tag, tagColor, config, stepperValues, isHighlighted }) {
  // Calculate total price
  const calculatePrice = () => {
    let total = 0;

    // Add workshop prices
    config.workshops.forEach(workshopKey => {
      if (productCatalog.workshops[workshopKey]) {
        total += productCatalog.workshops[workshopKey].price;
      }
    });

    // Add challenge prices
    config.challenges.forEach(challengeKey => {
      if (productCatalog.challenges[challengeKey]) {
        total += productCatalog.challenges[challengeKey].price;
      }
    });

    // Add coaching prices
    config.coaching.forEach(coachingKey => {
      if (productCatalog.coaching[coachingKey]) {
        total += productCatalog.coaching[coachingKey].price;
      }
    });

    // Add wellness box costs
    total += stepperValues.small * 65;
    total += stepperValues.large * 125;

    return total;
  };

  const tagColors = {
    starter: { bg: '#e3f2fd', text: '#1976d2' },
    best: { bg: '#fff3e0', text: '#f57c00' },
    highest: { bg: '#e8f5e9', text: '#388e3c' }
  };

  return (
    <div>
      <style>{`
        .neuro-card {
          background: #e0e5e8;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.8);
          transition: all 0.3s ease;
          height: 100%;
        }

        .neuro-card:hover {
          box-shadow: 
            10px 10px 20px rgba(0, 0, 0, 0.15),
            -10px -10px 20px rgba(255, 255, 255, 0.9);
        }

        .neuro-card.highlighted {
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.1),
            inset -4px -4px 8px rgba(255, 255, 255, 0.7),
            0 0 0 3px #441d37;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 16px 0;
        }

        .feature-list li {
          padding: 8px 0;
          color: #555;
          font-size: 14px;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .feature-list li:last-child {
          border-bottom: none;
        }

        .price-tag {
          font-size: 24px;
          font-weight: 700;
          color: #013f7c;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 2px solid rgba(0,0,0,0.1);
        }
      `}</style>

      <div className={`neuro-card ${isHighlighted ? 'highlighted' : ''}`}>
        <h3 className="text-2xl font-bold mb-2" style={{ color: '#013f7c' }}>
          {title}
        </h3>
        <span 
          className="inline-block px-3 py-1 rounded-xl text-xs font-semibold uppercase mb-3"
          style={{ 
            background: tagColors[tagColor].bg, 
            color: tagColors[tagColor].text 
          }}
        >
          {tag}
        </span>

        <ul className="feature-list">
          {/* Workshops */}
          {config.workshops.map(workshopKey => (
            <li key={workshopKey}>
              {productCatalog.workshops[workshopKey]?.name}
            </li>
          ))}

          {/* Challenges */}
          {config.challenges.map(challengeKey => (
            <li key={challengeKey}>
              {productCatalog.challenges[challengeKey]?.name}
            </li>
          ))}

          {/* Coaching */}
          {config.coaching.map(coachingKey => (
            <li key={coachingKey}>
              {productCatalog.coaching[coachingKey]?.name}
            </li>
          ))}

          {/* Wellness Boxes */}
          {stepperValues.small > 0 && (
            <li>Small Wellness Boxes ({stepperValues.small})</li>
          )}
          {stepperValues.large > 0 && (
            <li>Large Wellness Boxes ({stepperValues.large})</li>
          )}

          {/* Platform Features */}
          {config.includePlatform && (
            <>
              <li>{productCatalog.platform.access.name}</li>
              <li>{productCatalog.platform.community.name}</li>
            </>
          )}

          {/* Reporting Features */}
          {config.includeReporting && (
            <>
              <li>{productCatalog.reporting.analytics.name}</li>
              <li>{productCatalog.reporting.roi.name}</li>
            </>
          )}
        </ul>

        <div className="price-tag">
          Est. Price: ${calculatePrice().toLocaleString()}
        </div>
      </div>
    </div>
  );
}