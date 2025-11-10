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
          background: #f4f0e9;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
          transition: all 0.3s ease;
          height: 100%;
        }

        .neuro-card:hover {
          box-shadow: 
            10px 10px 20px rgba(0, 0, 0, 0.15),
            -10px -10px 20px rgba(255, 255, 255, 0.95);
        }

        .neuro-card.highlighted {
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.1),
            inset -4px -4px 8px rgba(255, 255, 255, 0.8),
            0 0 0 3px #441d37;
        }

        .section-header {
          font-size: 13px;
          font-weight: 700;
          color: #013f7c;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 16px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 2px solid rgba(1, 63, 124, 0.2);
        }

        .section-header:first-child {
          margin-top: 0;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0 0 12px 0;
        }

        .feature-list li {
          padding: 6px 0;
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

        <div>
          {/* Workshops Section */}
          {config.workshops.length > 0 && (
            <>
              <div className="section-header">Workshops</div>
              <ul className="feature-list">
                {config.workshops.map(workshopKey => (
                  <li key={workshopKey}>
                    {productCatalog.workshops[workshopKey]?.name}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Challenges Section */}
          {config.challenges.length > 0 && (
            <>
              <div className="section-header">Challenges</div>
              <ul className="feature-list">
                {config.challenges.map(challengeKey => (
                  <li key={challengeKey}>
                    {productCatalog.challenges[challengeKey]?.name}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Coaching Section */}
          {config.coaching.length > 0 && (
            <>
              <div className="section-header">Coaching</div>
              <ul className="feature-list">
                {config.coaching.map(coachingKey => (
                  <li key={coachingKey}>
                    {productCatalog.coaching[coachingKey]?.name}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Wellness Boxes Section */}
          {(stepperValues.small > 0 || stepperValues.large > 0) && (
            <>
              <div className="section-header">Wellness Incentives</div>
              <ul className="feature-list">
                {stepperValues.small > 0 && (
                  <li>Small Wellness Boxes ({stepperValues.small})</li>
                )}
                {stepperValues.large > 0 && (
                  <li>Large Wellness Boxes ({stepperValues.large})</li>
                )}
              </ul>
            </>
          )}

          {/* Platform Features Section */}
          {config.includePlatform && (
            <>
              <div className="section-header">Platform Access</div>
              <ul className="feature-list">
                <li>{productCatalog.platform.access.name}</li>
                <li>{productCatalog.platform.community.name}</li>
              </ul>
            </>
          )}

          {/* Reporting Features Section */}
          {config.includeReporting && (
            <>
              <div className="section-header">Reporting & Analytics</div>
              <ul className="feature-list">
                <li>{productCatalog.reporting.analytics.name}</li>
                <li>{productCatalog.reporting.roi.name}</li>
              </ul>
            </>
          )}
        </div>

        <div className="price-tag">
          Est. Price: ${calculatePrice().toLocaleString()}
        </div>
      </div>
    </div>
  );
}