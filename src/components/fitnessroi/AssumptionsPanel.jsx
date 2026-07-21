import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function AssumptionsPanel({ inputs, onChange, headcount }) {
  const [open, setOpen] = useState(false);
  const update = (field, value) => onChange(prev => ({ ...prev, [field]: Number(value) }));

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-700">Our assumptions</span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-stone-600">Health premium / employee</span>
              <span className="block text-[10px] text-stone-400">Industry average</span>
            </div>
            <input type="number" value={inputs.healthPrem} onChange={e => update('healthPrem', e.target.value)}
              className="w-28 px-2 py-1.5 rounded-lg border border-stone-200 text-right text-stone-700" />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-stone-600">Absence days / year</span>
              <span className="block text-[10px] text-stone-400">BLS average</span>
            </div>
            <input type="number" step="0.1" value={inputs.absDays} onChange={e => update('absDays', e.target.value)}
              className="w-28 px-2 py-1.5 rounded-lg border border-stone-200 text-right text-stone-700" />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-stone-600">Participation rate</span>
              <span className="block text-[10px] text-stone-400">Based on team size ({headcount})</span>
            </div>
            <span className="text-stone-700 font-medium">{Math.round(inputs.participRate * 100)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-stone-600">Wellness fund</span>
              <span className="block text-[10px] text-stone-400">Default: $0</span>
            </div>
            <input type="number" value={inputs.wellnessFund} onChange={e => update('wellnessFund', e.target.value)}
              className="w-28 px-2 py-1.5 rounded-lg border border-stone-200 text-right text-stone-700" />
          </div>
        </div>
      )}
    </div>
  );
}