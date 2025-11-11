import React from 'react';
import { Check, Brain, Flame, MessageCircle, Sparkles, Heart, Users, TrendingUp, Shield, Umbrella, Snowflake, Activity, Apple, Move, Target, CircleDot, Link, MessagesSquare, HandHeart, Waves, Wind, Flower2, Crown, Lightbulb, Compass, Award, Gift } from 'lucide-react';

const iconMap = {
  Brain, Flame, MessageCircle, Sparkles, Heart, Users, TrendingUp, Shield, Umbrella, Snowflake, Activity, Apple, Move,
  Target, CircleDot, Link, MessagesSquare, HandHeart, Waves, Wind, Flower2, Crown, Lightbulb, Compass, Award, Gift
};

export default function SelectionCard({ title, description, price, icon, badge, isSelected, onToggle }) {
  const IconComponent = iconMap[icon];
  
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
          height: 100%;
          display: flex;
          flex-direction: column;
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

        .icon-circle {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #441d37 0%, #5a2747 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 
            3px 3px 6px rgba(0, 0, 0, 0.15),
            -2px -2px 4px rgba(255, 255, 255, 0.1);
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          background: rgba(1, 63, 124, 0.1);
          color: #013f7c;
          margin-bottom: 8px;
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
        
        <div className="icon-circle">
          {IconComponent && <IconComponent className="w-5 h-5 text-white" />}
        </div>

        {badge && <div className="badge">{badge}</div>}
        
        <h3 className="text-lg font-bold mb-2 pr-8" style={{ color: '#013f7c' }}>
          {title}
        </h3>
        <p className="text-sm mb-4 flex-grow" style={{ color: '#666' }}>
          {description}
        </p>
        <div className="text-xl font-bold" style={{ color: '#441d37' }}>
          ${typeof price === 'number' ? price.toLocaleString() : price}
        </div>
      </div>
    </div>
  );
}