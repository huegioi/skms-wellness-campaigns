import React from 'react';
import { Check, Award, Dumbbell, Activity, Crown, Package } from 'lucide-react';

const categoryIcons = {
  workshop: Award,
  challenge: Dumbbell,
  class: Activity,
  leadership: Crown,
  wellness_box: Package,
};

const categoryColors = {
  workshop: '#264d44',
  challenge: '#ff9878',
  class: '#013f7c',
  leadership: '#770142',
  wellness_box: '#7a8c1e',
};

export default function QuickBuilderServiceCard({ service, isSelected, onToggle }) {
  const image = service.images?.[0]?.url;
  const Icon = categoryIcons[service.category] || Package;
  const color = categoryColors[service.category] || '#264d44';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative text-left rounded-xl overflow-hidden transition-all border-2 ${
        isSelected
          ? 'border-brand-green shadow-md ring-2 ring-brand-green/20'
          : 'border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Image or fallback */}
      <div className="relative aspect-video bg-gray-100">
        {image ? (
          <img src={image} alt={service.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${color}1a, ${color}33)` }}
          >
            <Icon className="w-10 h-10" style={{ color }} />
          </div>
        )}
        {/* Checkmark overlay */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-brand-green flex items-center justify-center shadow-md">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      {/* Text */}
      <div className="p-3">
        <h4 className="font-semibold text-sm text-gray-800 leading-snug">{service.name}</h4>
        {service.short_description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{service.short_description}</p>
        )}
      </div>
    </button>
  );
}