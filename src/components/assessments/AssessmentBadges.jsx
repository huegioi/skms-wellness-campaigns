import React from 'react';

const ASSESSMENT_LABELS = {
  who5: 'WHO-5',
  enps: 'eNPS',
  uwes3: 'UWES-3',
  pss4: 'PSS-4',
  ucla3: 'UCLA-3',
  cbi: 'CBI',
};

// Small pill badges showing which validated assessments come with a service.
export default function AssessmentBadges({ assessments = [], size = 'sm' }) {
  if (!assessments || assessments.length === 0) return null;
  const sizeClasses = size === 'xs' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5';
  return (
    <div className="flex flex-wrap gap-1">
      {assessments.map(key => (
        <span
          key={key}
          className={`inline-block rounded-full bg-[#013f7c]/8 text-[#013f7c] font-medium leading-tight ${sizeClasses}`}
        >
          {ASSESSMENT_LABELS[key] || key.toUpperCase()}
        </span>
      ))}
    </div>
  );
}