import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, User, Loader2 } from 'lucide-react';

export default function EmailGate({ formData, onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) { setError('Please enter your name and work email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('createMfsJourney', {
        contact_name: name.trim(),
        email: email.trim(),
        company_name: formData.company_name || undefined,
        industry: formData.industry,
        headcount: Number(formData.headcount),
        avg_salary: Number(formData.avgSalary),
        turnover_rate: formData.turnoverRate,
        quick_answers: formData.quick_answers,
        ref: formData.ref || undefined,
      });
      if (res.data?.error) throw new Error(res.data.error);
      onSubmit(res.data);
    } catch (err) {
      setError(err?.message || err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
      <h2 className="text-xl font-bold text-[#4a2040] mb-2">See your results.</h2>
      <p className="text-sm text-stone-500 mb-4">Enter your work email to see your Mental Fitness Score and ROI projection.</p>
      <div className="space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-[#0f766e] focus:outline-none text-stone-800 text-sm" />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-[#0f766e] focus:outline-none text-stone-800 text-sm" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-[#0f766e] text-white rounded-full py-3.5 font-semibold hover:bg-[#0d6560] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</> : 'See my results'}
        </button>
      </div>
    </div>
  );
}