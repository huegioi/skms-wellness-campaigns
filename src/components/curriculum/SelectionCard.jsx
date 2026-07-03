import React from 'react';
import { Brain, Flame, MessageCircle, Heart, TrendingUp, Users, Target, Sparkles, Move, Apple, Activity, Wind, Waves, Flower2, Crown, Lightbulb, Compass, Shield, Award, Gift, CircleDot, Link, MessagesSquare, HandHeart, Umbrella, Snowflake } from 'lucide-react';

export default function SelectionCard({ title, description, price, icon, badge, image, isSelected, onToggle }) {
  const iconMap = {
    Brain, Flame, MessageCircle, Heart, TrendingUp, Users, Target, Sparkles, Move, Apple, Activity,
    Wind, Waves, Flower2, Crown, Lightbulb, Compass, Shield, Award, Gift, CircleDot, Link,
    MessagesSquare, HandHeart, Umbrella, Snowflake
  };

  const Icon = iconMap[icon];

  // Color palette for cards
  const colors = ['#770142', '#264d44', '#ff9878', '#013f7c', '#441d37'];
  const colorIndex = Math.abs(title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
  const accentColor = colors[colorIndex];

  return (
    <div
      onClick={onToggle}
      style={{
        background: isSelected ? accentColor : 'white',
        color: isSelected ? 'white' : '#333',
        borderRadius: '16px',
        padding: image ? 0 : '20px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: isSelected 
          ? '0 8px 24px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1)'
          : '0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)',
        position: 'relative',
        overflow: image ? 'hidden' : 'visible'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)';
          e.currentTarget.style.transform = 'translateY(-3px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {image && (
        <img src={image} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
      )}

      <div style={image ? { padding: '20px' } : undefined}>
        {/* Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          background: isSelected ? 'rgba(255, 255, 255, 0.2)' : accentColor
        }}>
          {Icon && <Icon className="w-7 h-7" style={{ color: 'white' }} />}
        </div>

        {/* Badge */}
        {badge && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.08)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {badge}
          </div>
        )}

        {/* Title */}
        {(() => {
          // Split on newline or " - " to detect title/subtitle pattern
          const parts = title.replace(/:\s*\n/, '\n').replace(/:\s+/, '\n').split('\n');
          const mainTitle = parts[0].replace(/:$/, '').trim();
          const subtitle = parts[1] ? parts[1].replace(/^:\s*/, '').trim() : null;
          return (
            <>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                marginBottom: subtitle ? '4px' : '8px',
                lineHeight: '1.3'
              }}>
                {mainTitle}
              </h3>
              {subtitle && (
                <p style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  opacity: isSelected ? 0.85 : 0.6,
                  lineHeight: '1.3'
                }}>
                  {subtitle}
                </p>
              )}
            </>
          );
        })()}

        {/* Description */}
        <p style={{
          fontSize: '14px',
          lineHeight: '1.5',
          marginBottom: '12px',
          opacity: isSelected ? 0.95 : 0.8
        }}>
          {description}
        </p>

        {/* Price */}
        <div style={{
          fontSize: '20px',
          fontWeight: '700',
          marginTop: 'auto'
        }}>
          {typeof price === 'number' ? `$${price.toLocaleString()}` : price}
        </div>
      </div>
    </div>
  );
}