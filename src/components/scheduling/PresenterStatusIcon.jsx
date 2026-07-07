import React from 'react';
import { CheckCircle, Clock, Circle } from 'lucide-react';

/** Returns 'accepted' | 'assigned' | 'unassigned' for a calendar event. */
export function getPresenterStatus(event) {
  if (event.presenter_accepted === true) return 'accepted';
  if (event.presenter_id || event.presenter) return 'assigned';
  return 'unassigned';
}

/**
 * Presenter status icon for delivery rows.
 *   unassigned → gray circle
 *   assigned   → amber clock
 *   accepted   → green check
 */
export default function PresenterStatusIcon({ event }) {
  const status = getPresenterStatus(event);
  if (status === 'accepted') return <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" title="Presenter accepted" />;
  if (status === 'assigned') return <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Presenter assigned, awaiting acceptance" />;
  return <Circle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="No presenter assigned" />;
}