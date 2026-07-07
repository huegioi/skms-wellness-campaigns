import React from 'react';
import { Check, Circle, ClipboardCheck } from 'lucide-react';

/**
 * Renders the three facilitation checklist marks for a challenge event:
 *   1. Day-0 assessment collected (CohortAssessment count >= 1)
 *   2. Day-14 assessment collected (CohortAssessment count >= 1)
 *   3. Recording/materials uploaded (recording_link present)
 *
 * compact=true  → inline row of check/circle icons (for event rows / cards)
 * compact=false → full titled card with descriptions (for detail views)
 */
export default function FacilitationChecklist({ day0Count = 0, day14Count = 0, hasRecording = false, compact = false }) {
  const marks = [
    {
      label: 'Day-0 assessment',
      done: day0Count >= 1,
      sub: day0Count > 0 ? `${day0Count} response${day0Count !== 1 ? 's' : ''}` : 'No responses yet',
    },
    {
      label: 'Day-14 assessment',
      done: day14Count >= 1,
      sub: day14Count > 0 ? `${day14Count} response${day14Count !== 1 ? 's' : ''}` : 'No responses yet',
    },
    {
      label: 'Recording uploaded',
      done: hasRecording,
      sub: hasRecording ? 'Linked' : 'Not yet uploaded',
    },
  ];

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