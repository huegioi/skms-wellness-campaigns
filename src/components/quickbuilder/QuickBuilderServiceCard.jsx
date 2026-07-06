import React from 'react';
import { Check } from 'lucide-react';
import ServiceImage from '@/components/quickbuilder/ServiceImage';

export default function QuickBuilderServiceCard({ service, isSelected, onToggle }) {
  const image = service.images?.[0]?.url;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative text-left rounded-xl overflow-hidden transition-all border-2 ${
        isSelected
          ? 'border-brand-green shadow-md ring-2 ring-brand-green/20'
          : 'border-transparent hover:border-gray-200 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="relative aspect-video bg-gray-100">
        {image ? (
          <ServiceImage src={image} alt={service.name} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-brand-navy/10 p-2">
            <span className="text-xs text-gray-500 text-center font-medium">{service.name}</span>
          </div>
        )}
        {isSelected && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-brand-green flex items-center justify-center shadow-md">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </button>
  );
}