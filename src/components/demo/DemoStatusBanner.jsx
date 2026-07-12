import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DemoStatusBanner({ counts, isLoading }) {
  if (isLoading || !counts) {
    return <div className="rounded-xl p-5 bg-gray-100 border-2 border-gray-200 animate-pulse h-20" />;
  }
  const hasDemo = counts.total > 0;

  return (
    <div className={`rounded-xl p-5 flex items-center gap-4 ${hasDemo ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-100 border-2 border-gray-200'}`}>
      {hasDemo
        ? <AlertTriangle className="w-7 h-7 text-red-600 shrink-0" />
        : <CheckCircle2 className="w-7 h-7 text-gray-400 shrink-0" />}
      <div>
        <p className={`font-bold text-lg ${hasDemo ? 'text-red-800' : 'text-gray-700'}`}>
          {hasDemo ? 'Demo data present' : 'No demo data'}
        </p>
        <p className={`text-sm ${hasDemo ? 'text-red-600' : 'text-gray-500'}`}>
          {hasDemo
            ? `${counts.total} demo records across all entities. This data is excluded from syncs, briefings, and analytics.`
            : 'The broker-demo environment is empty. Click "Seed demo data" to populate sample records.'}
        </p>
      </div>
    </div>
  );
}