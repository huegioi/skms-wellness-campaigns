import React from 'react';

// One-line auto-generated narrative summarizing the year.
// e.g. "In 2026, 142 employees engaged; participants' WHO-5 wellbeing rose +22 points — uncontrolled pre/post."
export default function NarrativeSummary({ year, peopleEngaged, who5Delta, evidenceTier }) {
  let narrative = '';

  if (year && peopleEngaged != null && peopleEngaged > 0) {
    narrative = `In ${year}, ${peopleEngaged} ${peopleEngaged === 1 ? 'person' : 'people'} engaged`;
  } else if (peopleEngaged != null && peopleEngaged > 0) {
    narrative = `${peopleEngaged} ${peopleEngaged === 1 ? 'person' : 'people'} engaged`;
  }

  if (who5Delta != null) {
    const mag = Math.abs(who5Delta).toFixed(0);
    const direction = who5Delta > 0 ? `rose +${mag}` : who5Delta < 0 ? `fell ${mag}` : 'held steady';
    const deltaPart = `participants' WHO-5 wellbeing ${direction} point${mag !== '1' ? 's' : ''}`;
    if (narrative) {
      narrative += `; ${deltaPart}`;
    } else {
      narrative = deltaPart.charAt(0).toUpperCase() + deltaPart.slice(1);
    }
    if (evidenceTier) {
      narrative += ` — ${evidenceTier}`;
    }
  }

  if (!narrative) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-sm text-gray-700 leading-relaxed">{narrative}.</p>
    </div>
  );
}