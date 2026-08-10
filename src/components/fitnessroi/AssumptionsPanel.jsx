import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Every number the projection depends on, in one place.
 *
 * Only fields the model actually reads appear here. The old "health premium /
 * employee" input was removed in the 2026-08-08 rebuild: the medical driver is
 * no longer a share of premium, it is Wang 2007's per-person benefit applied to
 * the small fraction of distressed participants who actually reach treatment.
 * Leaving an input on screen that moves nothing is worse than having no input.
 */
function Row({ label, note, children }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <div>
        <span className="text-stone-600">{label}</span>
        <span className="block text-[10px] text-stone-400">{note}</span>
      </div>
      {children}
    </div>
  );
}

export default function AssumptionsPanel({ inputs, onChange, headcount, conditionCount = 0 }) {
  const [open, setOpen] = useState(false);
  const update = (field, value) => onChange(prev => ({ ...prev, [field]: Number(value) }));
  const pct = (v) => Math.round((v || 0) * 100);
  const numCls = 'w-28 px-2 py-1.5 rounded-lg border border-stone-200 text-right text-stone-700';

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-700">Our assumptions</span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <Row label="Employees" note="From your inputs">
            <span className="text-stone-700 font-medium">{(headcount || 0).toLocaleString()}</span>
          </Row>

          <Row label="Average salary" note="Drives every time-based driver">
            <input type="number" value={inputs.avgSalary ?? ''} onChange={e => update('avgSalary', e.target.value)}
              className={numCls} />
          </Row>

          <Row label="Absence days / year" note="BLS average unless you changed it">
            <input type="number" step="0.1" value={inputs.absDays ?? ''} onChange={e => update('absDays', e.target.value)}
              className={numCls} />
          </Row>

          <Row label="Annual turnover" note="Only the share we could plausibly influence is counted">
            <span className="text-stone-700 font-medium">{pct(inputs.turnoverRate)}%</span>
          </Row>

          <Row label="Share reporting distress" note="From your team's responses">
            <span className="text-stone-700 font-medium">{pct(inputs.stressRate)}%</span>
          </Row>

          <Row
            label="Participation rate"
            note={
              conditionCount > 0
                ? `Earned by the ${conditionCount} commitment${conditionCount === 1 ? '' : 's'} you selected above`
                : 'The observed floor with no design commitments — change this above, not here'
            }
          >
            <span className="text-stone-700 font-medium">{pct(inputs.participRate)}%</span>
          </Row>

          <Row label="Wellness fund" note="Offsets your investment. Default: $0">
            <input type="number" value={inputs.wellnessFund ?? 0} onChange={e => update('wellnessFund', e.target.value)}
              className={numCls} />
          </Row>

          <p className="text-[10px] text-stone-400 leading-relaxed pt-2 border-t border-stone-100">
            Savings are counted only for the people the programme actually reaches, only for the four
            drivers we can evidence, and only at effect sizes reported in peer-reviewed work. Year one is
            partial and later years account for reach falling away.
          </p>
        </div>
      )}
    </div>
  );
}
