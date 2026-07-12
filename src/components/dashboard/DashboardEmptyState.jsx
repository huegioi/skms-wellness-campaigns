import React from 'react';

/**
 * Friendly empty state: icon + one line, matching chart height (h-64).
 * Drop inside any CardContent.
 */
export default function DashboardEmptyState({ icon: Icon, message }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-3 text-gray-400">
      {Icon && <Icon className="w-10 h-10" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}