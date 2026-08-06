import React from 'react';

// Compact purple "DEMO" + gray "INTERNAL" badges, reused wherever a demo or
// internal record is surfaced (events, clients, proposals, leads, campaigns).
// Matches the Assessments page badge style.

export function DemoBadge({ className = '' }) {
  return (
    <span className={`text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold ${className}`}>
      DEMO
    </span>
  );
}

export function InternalBadge({ className = '' }) {
  return (
    <span className={`text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold ${className}`}>
      INTERNAL
    </span>
  );
}

/** Convenience: render a DEMO badge if `record.is_demo`, else INTERNAL if internal. */
export function DemoOrInternalBadge({ record, className = '' }) {
  if (!record) return null;
  if (record.is_demo) return <DemoBadge className={className} />;
  if (record.is_internal) return <InternalBadge className={className} />;
  return null;
}