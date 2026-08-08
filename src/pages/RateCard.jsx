import React from 'react';
import RateCardPanel from '@/components/services/RateCardPanel';

/**
 * Standalone route for the rate card editor.
 *
 * The editor normally lives in the Services tab (ServiceCatalog). This page is
 * kept so existing /RateCard links and bookmarks still work.
 */
export default function RateCard() {
  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <RateCardPanel />
      </div>
    </div>
  );
}
