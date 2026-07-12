import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import QuickBuilderServiceCard from './QuickBuilderServiceCard';

export default function QuickBuilderCategoryStep({ title, subtitle, services, selectedIds, onToggle, onBack, onNext, isLoading }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No services available in this category.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {services.map(svc => (
            <QuickBuilderServiceCard
              key={svc.id}
              service={svc}
              isSelected={selectedIds.has(svc.id)}
              onToggle={() => onToggle(svc.id)}
            />
          ))}
        </div>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={onNext} className="bg-brand-navy hover:bg-brand-navy-dark gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}