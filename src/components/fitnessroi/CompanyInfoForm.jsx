import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INDUSTRIES = ['Healthcare', 'Technology', 'Manufacturing', 'Financial Services', 'Professional Services', 'Retail & Hospitality', 'Education', 'Nonprofit', 'Government', 'Other'];

export default function CompanyInfoForm({ values, onChange, onSubmit }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-5 shadow-sm space-y-4">
      <div>
        <label className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1.5 block">How many employees?</label>
        <input type="number" min="1" value={values.headcount} onChange={e => onChange({ ...values, headcount: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-[#0f766e] focus:outline-none text-stone-800" placeholder="e.g. 250" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1.5 block">Average annual salary</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
          <input type="number" min="0" step="1000" value={values.avgSalary} onChange={e => onChange({ ...values, avgSalary: e.target.value })}
            className="w-full pl-8 pr-4 py-3 rounded-xl border border-stone-200 focus:border-[#0f766e] focus:outline-none text-stone-800" />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1.5 block">Annual turnover</label>
        <div className="flex items-center gap-3">
          <input type="range" min="5" max="60" step="1" value={Math.round(values.turnoverRate * 100)}
            onChange={e => onChange({ ...values, turnoverRate: parseInt(e.target.value) / 100 })}
            className="flex-1 accent-[#0f766e]" />
          <span className="text-stone-700 font-semibold text-sm w-12 text-right">{Math.round(values.turnoverRate * 100)}%</span>
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1.5 block">Industry</label>
        <Select value={values.industry} onValueChange={v => onChange({ ...values, industry: v })}>
          <SelectTrigger className="w-full rounded-xl border-stone-200"><SelectValue placeholder="Select industry" /></SelectTrigger>
          <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <button onClick={onSubmit} className="w-full bg-[#0f766e] text-white rounded-full py-3.5 font-semibold hover:bg-[#0d6560] transition-colors">
        See my results
      </button>
    </div>
  );
}