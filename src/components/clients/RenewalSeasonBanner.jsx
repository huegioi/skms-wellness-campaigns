import React from 'react';
import { CalendarClock, Filter, X } from 'lucide-react';

/**
 * Season banner shown above the client board when today is within 90 days of a
 * Jan 1 / July 1 cohort date. Clicking toggles a board filter to that cohort.
 */
export default function RenewalSeasonBanner({
  activeCohort,
  cohortClients,
  reviewsBooked,
  unscheduledCount,
  cohortFilter,
  onToggleFilter,
}) {
  if (!activeCohort) return null;

  const isFiltered = cohortFilter === activeCohort.label;
  const total = cohortClients.length;

  return (
    <div className="mb-4 rounded-lg border border-[#770142]/30 bg-gradient-to-r from-[#770142]/10 to-[#770142]/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#770142]">
          <CalendarClock className="w-4 h-4" />
          Renewal season: {activeCohort.label} cohort
        </span>
        <span className="text-xs text-gray-600">
          {total} client{total !== 1 ? 's' : ''} · {reviewsBooked} renewal review{reviewsBooked !== 1 ? 's' : ''} booked · {unscheduledCount} with unscheduled services
        </span>
        <span className="text-xs text-[#770142] font-medium">{activeCohort.daysRemaining}d to go</span>
      </div>
      <button
        onClick={onToggleFilter}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${
          isFiltered
            ? 'bg-white text-[#770142] border border-[#770142] hover:bg-[#770142]/5'
            : 'bg-[#770142] text-white hover:bg-[#5a0132]'
        }`}
      >
        {isFiltered ? <><X className="w-3.5 h-3.5" /> Clear filter</> : <><Filter className="w-3.5 h-3.5" /> Filter board</>}
      </button>
    </div>
  );
}