import React from 'react';
import { CalendarCheck, Calendar, ClipboardList, Package, RefreshCw, CheckCircle2 } from 'lucide-react';
import { renderInline } from '@/lib/renderInline';

/**
 * Structured delivery snapshot — mirrors FollowUpsSection's visual language.
 * Informational only (rows are not checkable).
 */
export default function DeliverySection({ snapshot }) {
  if (!snapshot) return null;

  const sessions = snapshot.todayTomorrowSessions || [];
  const presenterGaps = snapshot.presenterGapSessions || [];
  const assessmentGaps = snapshot.challengeAssessmentGaps || [];
  const unscheduledTotal = snapshot.unscheduledServicesTotal || 0;
  const unscheduledClients = snapshot.clientsWithDelivery || 0;
  const activeCohort = snapshot.activeCohort || null;
  const renewalGaps = snapshot.renewalReviewGaps || [];

  const gapCount = presenterGaps.length + assessmentGaps.length;
  const totalRows =
    sessions.length +
    assessmentGaps.length +
    (unscheduledTotal > 0 ? 1 : 0) +
    renewalGaps.length;

  const allEmpty =
    sessions.length === 0 &&
    assessmentGaps.length === 0 &&
    unscheduledTotal === 0 &&
    renewalGaps.length === 0;

  if (allEmpty) {
    return (
      <div className="pt-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarCheck className="w-3.5 h-3.5 text-[#264d44]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#264d44]">Delivery</h3>
          <span className="rounded-full bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">0</span>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-600">No sessions today or tomorrow — delivery is all clear.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3">
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck className="w-3.5 h-3.5 text-[#264d44]" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#264d44]">Delivery</h3>
        <span className="rounded-full bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">{totalRows}</span>
        {gapCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-medium">{gapCount} gaps</span>
        )}
      </div>
      <div className="space-y-0.5">
        {/* Today / tomorrow sessions */}
        {sessions.map((s, i) => {
          const isPresenterGap = !s.presenterAccepted && !s.completed;
          return (
            <div
              key={`session-${i}`}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                isPresenterGap ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm leading-snug text-gray-700">
                {renderInline(`${s.title} — ${s.start} (${s.client || 'no client'})`)}
                {s.completed && (
                  <span className="ml-2 rounded-full bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 font-medium">✓ done</span>
                )}
                {isPresenterGap && (
                  <span className="ml-2 rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-medium">presenter not accepted</span>
                )}
              </span>
            </div>
          );
        })}

        {/* Challenge assessment gaps */}
        {assessmentGaps.map((g, i) => (
          <div
            key={`gap-${i}`}
            className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-amber-50/50 hover:bg-amber-50 transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm leading-snug text-gray-700">
              {renderInline(`${g.client} — missing ${g.missing} of the cohort assessment`)}
              <span className="ml-2 rounded-full bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 font-medium">assessment gap</span>
            </span>
          </div>
        ))}

        {/* Unscheduled services summary */}
        {unscheduledTotal > 0 && (
          <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm leading-snug text-gray-700">
              {unscheduledTotal} unscheduled service{unscheduledTotal !== 1 ? 's' : ''} across {unscheduledClients} client{unscheduledClients !== 1 ? 's' : ''}
              <span className="ml-2 rounded-full bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">{unscheduledTotal}</span>
            </span>
          </div>
        )}

        {/* Renewal sub-section */}
        {activeCohort && renewalGaps.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2 pb-1">
              <RefreshCw className="w-3.5 h-3.5 text-[#770142]" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#770142]">Renewal</h4>
              <span className="text-xs text-gray-400">{activeCohort.label}</span>
            </div>
            {renewalGaps.map((g, i) => {
              const days = g.daysRemaining;
              const isUrgent = days <= 30;
              return (
                <div
                  key={`renewal-${i}`}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm leading-snug text-gray-700">
                    {renderInline(`${g.client} — no strategic review booked`)}
                    <span className={`ml-2 rounded-full text-[10px] px-1.5 py-0.5 font-medium ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {days}d left
                    </span>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}