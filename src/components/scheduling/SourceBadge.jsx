import React from 'react';

const BADGE_STYLES = {
  Sheet: 'bg-gray-100 text-gray-600 border-gray-300',
  App: 'bg-blue-50 text-blue-700 border-blue-200',
  Google: 'bg-amber-50 text-amber-700 border-amber-200',
};

/** Small chip showing where a row came from: Sheet / App / Google. */
export default function SourceBadge({ source }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${BADGE_STYLES[source] || BADGE_STYLES.App}`}>
      {source}
    </span>
  );
}