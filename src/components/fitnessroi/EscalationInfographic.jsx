import React from 'react';
import { AlertTriangle, Activity, AlertOctagon } from 'lucide-react';

export default function EscalationInfographic() {
  const stages = [
    { icon: AlertTriangle, label: 'Sub-Clinical Distress', desc: 'Chronic stress, anxiety, burnout — invisible so far', color: '#f59e0b' },
    { icon: Activity, label: 'Somatic Manifestation', desc: 'Insomnia, GI issues, chronic pain — physician visits begin', color: '#f97316' },
    { icon: AlertOctagon, label: 'Acute Medical Event', desc: 'ER visits, admissions, prolonged claims', color: '#dc2626' },
  ];
  return (
    <div className="bg-stone-50 rounded-xl p-4 mb-5">
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">The Cost of Inaction — Pre-Patient Escalation</p>
      <div className="flex items-stretch">
        <div className="flex-1 text-center px-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: stages[0].color + '20' }}>
            <AlertTriangle className="w-4 h-4" style={{ color: stages[0].color }} />
          </div>
          <p className="text-[11px] font-bold text-stone-700 leading-tight">{stages[0].label}</p>
          <p className="text-[9px] text-stone-500 mt-1 leading-tight">{stages[0].desc}</p>
        </div>
        <div className="flex flex-col items-center justify-start px-1 shrink-0">
          <div className="w-0.5 h-9 bg-[#0f766e]" />
          <div className="bg-[#0f766e] text-white text-[8px] font-bold px-2 py-1 rounded-full whitespace-nowrap mt-1">
            SkillfulMeans
          </div>
        </div>
        <div className="flex-1 text-center px-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: stages[1].color + '20' }}>
            <Activity className="w-4 h-4" style={{ color: stages[1].color }} />
          </div>
          <p className="text-[11px] font-bold text-stone-700 leading-tight">{stages[1].label}</p>
          <p className="text-[9px] text-stone-500 mt-1 leading-tight">{stages[1].desc}</p>
        </div>
        <div className="w-2 shrink-0" />
        <div className="flex-1 text-center px-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: stages[2].color + '20' }}>
            <AlertOctagon className="w-4 h-4" style={{ color: stages[2].color }} />
          </div>
          <p className="text-[11px] font-bold text-stone-700 leading-tight">{stages[2].label}</p>
          <p className="text-[9px] text-stone-500 mt-1 leading-tight">{stages[2].desc}</p>
        </div>
      </div>
    </div>
  );
}