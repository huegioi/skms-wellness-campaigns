import React from 'react';
import { Check, Circle, ClipboardCheck } from 'lucide-react';

/**
 * Renders facilitation checklist marks for an event.
 *
 * Props:
 *   day0Count       — challenge Day-0 assessment count (includes check-in baseline for challenges)
 *   day14Count      — challenge Day-14 assessment count (includes check-in endpoint for challenges)
 *   baselineCount   — baseline assessment count (cohort_start for non-challenges)
 *   endpointCount   — endpoint assessment count (cohort_end for non-challenges)
 *   checkinCount    — total checked-in attendees (for "N of M" display)
 *   hasRecording    — whether a recording link exists
 *   compact         — inline row vs full card
 */
export default function FacilitationChecklist({
  day0Count = 0,
  day14Count = 0,
  baselineCount,
  endpointCount,
  sessionCount,
  checkinCount = 0,
  hasRecording = false,
  compact = false,
}) {
  const marks = [];
  const isSession = sessionCount !== undefined;

  // Challenge marks (day0 / day14) — shown when day0Count or day14Count is explicitly provided
  if (!isSession && (day0Count > 0 || day14Count > 0 || (baselineCount === undefined && endpointCount === undefined))) {
    marks.push({
      label: 'Day-0 assessment',
      done: day0Count >= 1,
      sub: checkinCount > 0
        ? `${day0Count} of ${checkinCount} checked-in gave baseline`
        : day0Count > 0 ? `${day0Count} response${day0Count !== 1 ? 's' : ''}` : 'No responses yet',
    });
    marks.push({
      label: 'Day-14 assessment',
      done: day14Count >= 1,
      sub: checkinCount > 0
        ? `${day14Count} of ${checkinCount} checked-in gave endpoint`
        : day14Count > 0 ? `${day14Count} response${day14Count !== 1 ? 's' : ''}` : 'No responses yet',
    });
  }

  // Non-challenge baseline/endpoint marks — shown when baselineCount or endpointCount is provided
  if (!isSession && baselineCount !== undefined) {
    marks.push({
      label: 'Baseline assessment',
      done: baselineCount >= 1,
      sub: checkinCount > 0
        ? `${baselineCount} of ${checkinCount} checked-in gave baseline`
        : baselineCount > 0 ? `${baselineCount} response${baselineCount !== 1 ? 's' : ''}` : 'No responses yet',
    });
  }
  if (!isSession && endpointCount !== undefined) {
    marks.push({
      label: 'Endpoint assessment',
      done: endpointCount >= 1,
      sub: checkinCount > 0
        ? `${endpointCount} of ${checkinCount} checked-in gave endpoint`
        : endpointCount > 0 ? `${endpointCount} response${endpointCount !== 1 ? 's' : ''}` : 'No responses yet',
    });
  }

  // Session-timing: a single "Session check-in survey" mark (done when ≥1
  // session_check assessment exists for this event). Does NOT show the
  // permanently-red baseline item.
  if (isSession) {
    marks.push({
      label: 'Session check-in survey',
      done: sessionCount >= 1,
      sub: checkinCount > 0
        ? `${sessionCount} of ${checkinCount} checked-in gave session feedback`
        : sessionCount > 0 ? `${sessionCount} response${sessionCount !== 1 ? 's' : ''}` : 'No responses yet',
    });
  }

  // Recording mark
  marks.push({
    label: 'Recording uploaded',
    done: hasRecording,
    sub: hasRecording ? 'Linked' : 'Not yet uploaded',
  });

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 flex-wrap">
        {marks.map((m, i) => (
          <div key={i} className="flex items-center gap-1" title={`${m.label}: ${m.sub}`}>
            {m.done
              ? <Check className="w-3.5 h-3.5 text-emerald-600" />
              : <Circle className="w-3.5 h-3.5 text-gray-300" />}
            <span className={`text-xs font-medium ${m.done ? 'text-emerald-700' : 'text-gray-400'}`}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> Facilitation Checklist
        </h2>
      </div>
      <div className="p-5 space-y-3">
        {marks.map((m, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.done ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              {m.done
                ? <Check className="w-4 h-4 text-emerald-600" />
                : <Circle className="w-4 h-4 text-gray-300" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${m.done ? 'text-gray-800' : 'text-gray-500'}`}>{m.label}</p>
              <p className="text-xs text-gray-400">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}