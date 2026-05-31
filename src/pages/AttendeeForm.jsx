import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2 } from 'lucide-react';

// Mobile-optimized slider component
function ScaleSlider({ value, onChange, min = 1, max = 5, labels }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-14 rounded-xl font-bold text-lg transition-all border-2 ${
              value === n
                ? 'bg-[#264d44] text-white border-[#264d44] shadow-lg scale-105'
                : 'bg-white text-gray-500 border-gray-200 hover:border-[#264d44] hover:text-[#264d44]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

function NPSRow({ value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 min-w-[2.2rem] h-12 rounded-lg font-bold text-sm transition-all border-2 ${
              value === n
                ? 'bg-[#013f7c] text-white border-[#013f7c] shadow-lg scale-105'
                : 'bg-white text-gray-500 border-gray-200 hover:border-[#013f7c]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
    </div>
  );
}

export default function AttendeeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const serviceIdFromUrl = urlParams.get('service_id');
  const clientIdFromUrl = urlParams.get('client_id');

  const [form, setForm] = useState({
    pre_stress_impact: null,
    tool_equipped_confidence: null,
    pressure_management_ability: null,
    nps_score: null,
    biggest_takeaway: '',
    full_name: '',
    email_address: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const { data: service } = useQuery({
    queryKey: ['attendee-service', serviceIdFromUrl],
    queryFn: async () => {
      if (!serviceIdFromUrl) return null;
      const res = await base44.entities.Service.filter({ id: serviceIdFromUrl });
      return res[0] || null;
    },
    enabled: !!serviceIdFromUrl
  });

  const { data: client } = useQuery({
    queryKey: ['attendee-client', clientIdFromUrl],
    queryFn: async () => {
      if (!clientIdFromUrl) return null;
      const res = await base44.entities.Client.filter({ id: clientIdFromUrl });
      return res[0] || null;
    },
    enabled: !!clientIdFromUrl
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.entities.FeedbackResponse.create({
      service_id: serviceIdFromUrl || '',
      service_name: service?.name || '',
      client_id: clientIdFromUrl || '',
      company_name: client?.company || '',
      full_name: form.full_name,
      email_address: form.email_address,
      pre_stress_impact: form.pre_stress_impact,
      tool_equipped_confidence: form.tool_equipped_confidence,
      pressure_management_ability: form.pressure_management_ability,
      nps_score: form.nps_score,
      biggest_takeaway: form.biggest_takeaway,
      overall_rating: [form.pre_stress_impact, form.tool_equipped_confidence, form.pressure_management_ability]
        .filter(Boolean).reduce((a, b, _, arr) => a + b / arr.length, 0) || null,
      submitted_at: new Date().toISOString(),
    }),
    onSuccess: () => setSubmitted(true)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  const canSubmit = form.pre_stress_impact && form.tool_equipped_confidence &&
    form.pressure_management_ability && form.nps_score !== null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <CheckCircle2 className="w-20 h-20 mx-auto mb-5 text-[#264d44]" />
          <h2 className="text-2xl font-bold text-[#013f7c] mb-2">Feedback Submitted!</h2>
          <p className="text-gray-500 text-sm">Thank you for helping us measure the impact of your wellness program.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white px-4 py-6 text-center">
        <img
          src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
          alt="SKMS Wellness"
          className="h-10 mx-auto mb-3"
        />
        <h1 className="text-xl font-bold">Session Feedback</h1>
        {service && <p className="text-blue-200 text-sm mt-1">{service.name}</p>}
        {client && <p className="text-blue-300 text-xs mt-0.5">{client.company}</p>}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ROI Metrics */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Rate Today's Session</p>

            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1">
                How much did today reduce your stress/mental load?
              </label>
              <p className="text-xs text-gray-400 mb-3">1 = Not at all · 5 = Significantly</p>
              <ScaleSlider
                value={form.pre_stress_impact}
                onChange={v => setForm(f => ({ ...f, pre_stress_impact: v }))}
                labels={['Not at all', 'Significantly']}
              />
            </div>

            <div className="border-t pt-5">
              <label className="block text-base font-semibold text-gray-800 mb-1">
                How equipped do you feel to apply these tools at work?
              </label>
              <p className="text-xs text-gray-400 mb-3">1 = Not equipped · 5 = Very confident</p>
              <ScaleSlider
                value={form.tool_equipped_confidence}
                onChange={v => setForm(f => ({ ...f, tool_equipped_confidence: v }))}
                labels={['Not equipped', 'Very confident']}
              />
            </div>

            <div className="border-t pt-5">
              <label className="block text-base font-semibold text-gray-800 mb-1">
                How much better can you manage pressure after this session?
              </label>
              <p className="text-xs text-gray-400 mb-3">1 = No change · 5 = Much better</p>
              <ScaleSlider
                value={form.pressure_management_ability}
                onChange={v => setForm(f => ({ ...f, pressure_management_ability: v }))}
                labels={['No change', 'Much better']}
              />
            </div>
          </div>

          {/* NPS */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <label className="block text-base font-semibold text-gray-800">
              How likely are you to recommend this program to a colleague?
            </label>
            <NPSRow
              value={form.nps_score}
              onChange={v => setForm(f => ({ ...f, nps_score: v }))}
            />
          </div>

          {/* Biggest Takeaway */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              What's your biggest takeaway from today?
            </label>
            <Textarea
              value={form.biggest_takeaway}
              onChange={e => setForm(f => ({ ...f, biggest_takeaway: e.target.value }))}
              placeholder="Share one thing you'll carry with you..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Optional contact */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Optional — Your Info</p>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your name (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013f7c]/20"
            />
            <input
              type="email"
              value={form.email_address}
              onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))}
              placeholder="Email (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013f7c]/20"
            />
          </div>

          <Button
            type="submit"
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full h-14 text-base font-semibold rounded-xl"
            style={{ backgroundColor: canSubmit ? '#013f7c' : undefined }}
          >
            {submitMutation.isPending
              ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
              : 'Submit Feedback'}
          </Button>

          {!canSubmit && (
            <p className="text-center text-xs text-gray-400">Please answer all rating questions to submit.</p>
          )}
        </form>
      </div>
    </div>
  );
}