import React from 'react';
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs';
import CompanyStatsSection from '@/components/analytics/CompanyStatsSection';

/**
 * Company Stats — third page of the Analytics section.
 * The metric definitions and all computation live in CompanyStatsSection;
 * this page provides the Analytics chrome (tabs strip + title) so the three
 * Analytics pages look uniform.
 */
export default function CompanyStats() {
  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        <AnalyticsTabs current="CompanyStats" />

        <div className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Company Stats</h1>
          <p className="text-gray-600 mt-1">
            The book of business at a glance — active clients, lives covered, partners, and revenue.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Active = purchased within the past 2 years · demo &amp; internal records excluded
          </p>
        </div>

        <CompanyStatsSection />
      </div>
    </div>
  );
}
