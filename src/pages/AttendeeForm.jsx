import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
    expected_impact: [],
    attendee_name: '',
    attendee_email: '',
    enps_score: null,
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

  // Fetch matching CalendarEvent to capture presenter + delivery_format
  const { data: calendarEvent } = useQuery({
    queryKey: ['attendee-event', serviceIdFromUrl, clientIdFromUrl],
    queryFn: async () => {
      if (!serviceIdFromUrl) return null;
      const filter = { service_id: serviceIdFromUrl };
      if (clientIdFromUrl) filter.client_id = clientIdFromUrl;
      const res = await base44.entities.CalendarEvent.filter(filter, '-start_date', 1);
      return res[0] || null;
    },
    enabled: !!serviceIdFromUrl
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('submitFeedbackResponse', {
        service_id: serviceIdFromUrl || '',
        service_name: service?.name || '',
        service_category: service?.category || undefined,
        client_id: clientIdFromUrl || '',
        company_name: client?.company || '',
        presenter: calendarEvent?.presenter || undefined,
        delivery_format: calendarEvent?.delivery_format || undefined,
        behavior_intent: form.behavior_intent,
        fit_confidence: form.fit_confidence,
        expected_impact: form.expected_impact.length > 0 ? form.expected_impact : undefined,
        attendee_name: form.attendee_name.trim() || undefined,
        attendee_email: form.attendee_email.trim() || undefined,
        nps_score: form.enps_score,
        submitted_at: new Date().toISOString(),
      });
      // res is an Axios response — data is in res.data
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => setSubmitted(true),
    onError: (err) => console.error('Submission error:', err),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate();
  };

const IMPACT_OPTIONS = [
  'Personal well-being and stress levels',
  'Daily focus and productivity',
  'Communication and teamwork',
  'Resilience and workplace challenges',
  'Overall job satisfaction',
];

function ImpactCheckboxes({ value, onChange }) {
  const toggle = (option) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };
  return (
    <div className="space-y-2">
      {IMPACT_OPTIONS.map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => toggle(opt)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              value.includes(opt)
                ? 'bg-[#013f7c] border-[#013f7c]'
                : 'border-gray-300 group-hover:border-[#013f7c]'
            }`}
          >
            {value.includes(opt) && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}

  const showEnps = !service || !service.included_assessments || service.included_assessments.length === 0 || service.included_assessments.includes('enps');
  const canSubmit = form.behavior_intent.trim().length > 0 && form.fit_confidence !== null && (!showEnps || form.enps_score !== null);

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
                What is one specific, micro-action you plan to take based on today's session?
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
                On a scale of 0-10, how confident are you that you can successfully apply that micro-action to your daily life or work?
              </label>
            </div>
            <ConfidenceScale
              value={form.fit_confidence}
              onChange={v => setForm(f => ({ ...f, fit_confidence: v }))}
            />
          </div>

          {/* Q3: Expected Impact */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-2 mb-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#264d44] text-white text-sm font-bold flex items-center justify-center">3</span>
              <div>
                <label className="text-base font-semibold text-gray-800 leading-snug">
                  I expect this micro-action to have the biggest positive impact on my (select all that apply):
                </label>
                <p className="text-xs text-gray-400 mt-0.5">Optional</p>
              </div>
            </div>
            <ImpactCheckboxes
              value={form.expected_impact}
              onChange={v => setForm(f => ({ ...f, expected_impact: v }))}
            />
          </div>

          {/* Q4: eNPS */}
          {showEnps && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start gap-2 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#013f7c] text-white text-sm font-bold flex items-center justify-center">4</span>
                <label className="text-base font-semibold text-gray-800 leading-snug">
                  How likely are you to recommend this program to a colleague?
                </label>
              </div>
              <ConfidenceScale
                value={form.enps_score}
                onChange={v => setForm(f => ({ ...f, enps_score: v }))}
              />
            </div>
          )}

          {/* Optional Contact Fields */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Want to be attributed? (Optional)</p>
            <Input
              type="text"
              placeholder="Name (Optional)"
              value={form.attendee_name}
              onChange={e => setForm(f => ({ ...f, attendee_name: e.target.value }))}
            />
            <Input
              type="email"
              placeholder="Email (Optional)"
              value={form.attendee_email}
              onChange={e => setForm(f => ({ ...f, attendee_email: e.target.value }))}
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

          {submitMutation.isError && (
            <p className="text-center text-xs text-red-500 mt-2">
              Submission failed: {submitMutation.error?.message || 'Unknown error'}. Please try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}