import React from 'react';

function Row({ label, value, sub }) {
  const present = value > 0;
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2.5 px-4 font-medium text-gray-700">{label}</td>
      <td className="py-2.5 px-4 text-right whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {present ? value : 'missing'}
        </span>
        {sub && <span className="ml-2 text-sm text-gray-500">{sub}</span>}
      </td>
    </tr>
  );
}

export default function DemoInventoryTable({ counts }) {
  if (!counts) return null;
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <table className="w-full">
        <tbody>
          <Row label="Clients" value={counts.clients} />
          <Row label="Referral Partners" value={counts.referralPartners} />
          <Row label="Referrals" value={counts.referrals} />
          <Row label="Proposals" value={counts.proposals} />
          <Row label="Invoices" value={counts.invoices} />
          <Row
            label="Calendar Events"
            value={counts.calendarEventsDelivered + counts.calendarEventsUpcoming}
            sub={`${counts.calendarEventsDelivered} delivered / ${counts.calendarEventsUpcoming} upcoming`}
          />
          <Row label="Feedback Responses" value={counts.feedbackResponses} />
          <Row
            label="Cohort Assessments"
            value={counts.cohortDay0 + counts.cohortDay14 + counts.cohortStart + counts.cohortEnd}
            sub={`${counts.cohortDay0} day0 / ${counts.cohortDay14} day14 · ${counts.cohortStart} start / ${counts.cohortEnd} end`}
          />
          <Row label="Client Tasks" value={counts.clientTasks} />
          <Row label="Referral Activities" value={counts.referralActivities} />
          <Row
            label="MFS Assessments"
            value={counts.mfsAssessments || 0}
            sub={counts.mfsResponses ? `${counts.mfsResponses} responses` : undefined}
          />
        </tbody>
      </table>
    </div>
  );
}