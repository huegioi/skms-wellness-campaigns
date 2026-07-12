import React from 'react';
import { CheckCircle, Clock, Circle, XCircle } from 'lucide-react';

/** Returns 'accepted' | 'assigned' | 'declined' | 'unassigned' for a calendar event. */
export function getPresenterStatus(event) {
  if (event.presenter_accepted === true) return 'accepted';
  if (event.presenter_id || event.presenter) return 'assigned';
  if (event.presenter_declined_at) return 'declined';
  return 'unassigned';
}

/**
 * Presenter status icon for delivery rows.
 *   unassigned → gray circle
 *   assigned   → amber clock
 *   accepted   → green check
 *   declined   → red X
 */
export default function PresenterStatusIcon({ event }) {
  const status = getPresenterStatus(event);
  if (status === 'accepted') return <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" title="Presenter accepted" />;
  if (status === 'assigned') return <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Presenter assigned, awaiting acceptance" />;
  if (status === 'declined') return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" title="Presenter declined — needs reassignment" />;
  return <Circle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="No presenter assigned" />;
}