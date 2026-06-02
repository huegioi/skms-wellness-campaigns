import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2 } from 'lucide-react';

function ConfidenceScale({ value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
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
        <span>Not at all</span>
        <span>Absolutely</span>
      </div>
    </div>
  );
}

export default function AttendeeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const serviceIdFromUrl = urlParams.get('service_id');
  const clientIdFromUrl = urlParams.get('client_id');

  const [form, setForm] = useState({
    behavior_intent: '',
    fit_confidence: null,
    advocacy_referral: '',
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
      behavior_intent: form.behavior_intent,
      fit_confidence: form.fit_confidence,
      advocacy_referral: form.advocacy_referral || undefined,
      submitted_at: new Date().toISOString(),
    }),
    onSuccess: () => setSubmitted(true)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  const canSubmit = form.behavior_intent.trim().length > 0 && form.fit_confidence !== null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <CheckCircle2 className="w-20 h-20 mx-auto mb-5 text-[#264d44]" />
          <h2 className="text-2xl font-bold text-[#013f7c] mb-2">Thank you!</h2>
          <p className="text-gray-500 text-sm">Your response helps us understand the real impact of this program.</p>
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
        <h1 className="text-xl font-bold">Quick Pulse Check</h1>
        <p className="text-blue-200 text-xs mt-1">~90 seconds · 3 questions</p>
        {service && <p className="text-blue-200 text-sm mt-2 font-medium">{service.name}</p>}
        {client && <p className="text-blue-300 text-xs mt-0.5">{client.company}</p>}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Q1: Behavior Intent */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-2 mb-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#013f7c] text-white text-sm font-bold flex items-center justify-center">1</span>
              <label className="text-base font-semibold text-gray-800 leading-snug">
                What's one thing you'll do differently this week because of this?
              </label>
            </div>
            <Textarea
              value={form.behavior_intent}
              onChange={e => {
                if (e.target.value.length <= 140) {
                  setForm(f => ({ ...f, behavior_intent: e.target.value }));
                }
              }}
              placeholder="e.g. I'll take a 5-minute breathing break before meetings..."
              rows={3}
              className="resize-none"
              required
            />
            <p className="text-right text-xs text-gray-400 mt-1">{form.behavior_intent.length}/140</p>
          </div>

          {/* Q2: Fit Confidence */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-2 mb-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#013f7c] text-white text-sm font-bold flex items-center justify-center">2</span>
              <label className="text-base font-semibold text-gray-800 leading-snug">
                How confident are you that this will fit into your life right now?
              </label>
            </div>
            <ConfidenceScale
              value={form.fit_confidence}
              onChange={v => setForm(f => ({ ...f, fit_confidence: v }))}
            />
          </div>

          {/* Q3: Advocacy / Referral */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-2 mb-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#264d44] text-white text-sm font-bold flex items-center justify-center">3</span>
              <div>
                <label className="text-base font-semibold text-gray-800 leading-snug">
                  Who comes to mind that should experience this?
                </label>
                <p className="text-xs text-gray-400 mt-0.5">First name + role (optional)</p>
              </div>
            </div>
            <input
              type="text"
              value={form.advocacy_referral}
              onChange={e => setForm(f => ({ ...f, advocacy_referral: e.target.value }))}
              placeholder="e.g. Sarah, team lead · Marcus, new hire"
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
              : 'Submit'}
          </Button>

          {!canSubmit && (
            <p className="text-center text-xs text-gray-400">Please answer questions 1 and 2 to submit.</p>
          )}
        </form>
      </div>
    </div>
  );
}