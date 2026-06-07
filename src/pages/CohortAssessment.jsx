import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2 } from 'lucide-react';

const WHO5_QUESTIONS = [
  { key: 'who5_cheerful', text: 'I have felt cheerful and in good spirits' },
  { key: 'who5_calm',     text: 'I have felt calm and relaxed' },
  { key: 'who5_active',   text: 'I have felt active and vigorous' },
  { key: 'who5_rested',   text: 'I woke up feeling fresh and rested' },
  { key: 'who5_interested', text: 'My daily life has been filled with things that interest me' },
];

const SCALE = [
  { value: 5, label: 'All of the time' },
  { value: 4, label: 'Most of the time' },
  { value: 3, label: 'More than half the time' },
  { value: 2, label: 'Less than half the time' },
  { value: 1, label: 'Some of the time' },
  { value: 0, label: 'At no time' },
];

export default function CohortAssessmentPage() {
  const params = new URLSearchParams(window.location.search);
  const service_id = params.get('service_id') || '';
  const client_id = params.get('client_id') || '';
  const proposal_id = params.get('proposal_id') || '';
  const timing = params.get('timing') || 'day0';

  const TIMING_MAP = {
    day0:        { survey_type: 'challenge_day0',  label: 'Day 0 Baseline' },
    day14:       { survey_type: 'challenge_day14', label: 'Day 14 Check-In' },
    cohort_start:{ survey_type: 'cohort_start',    label: 'Cohort Start Check-In' },
    cohort_end:  { survey_type: 'cohort_end',      label: 'Cohort End Check-In' },
  };
  const { survey_type, label: timingLabel } = TIMING_MAP[timing] || TIMING_MAP['day0'];

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const allAnswered = WHO5_QUESTIONS.every(q => answers[q.key] !== undefined);
  const canSubmit = email.trim() && allAnswered;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    const res = await base44.functions.invoke('submitCohortAssessment', {
      client_id,
      service_id,
      proposal_id,
      participant_email: email.trim(),
      participant_phone: phone.trim() || undefined,
      survey_type,
      who5_cheerful: answers.who5_cheerful,
      who5_calm: answers.who5_calm,
      who5_active: answers.who5_active,
      who5_rested: answers.who5_rested,
      who5_interested: answers.who5_interested,
    });
    setSubmitting(false);
    if (res?.data?.success) {
      setSubmitted(true);
    } else {
      setError(res?.data?.error || 'Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-[#264d44] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-600">Your {timingLabel} wellness check-in has been recorded.</p>
          <p className="text-sm text-gray-400 mt-4">You may close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-start justify-center p-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-xl w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-block bg-[#264d44] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
            {timingLabel}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Wellness Check-In</h1>
          <p className="text-gray-500 text-sm mt-1">SKMS Wellness · WHO-5 Wellbeing Index</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact fields */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">Used to match your check-in responses across time.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Phone Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full"
              />
            </div>
          </div>

          {/* WHO-5 Questions */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Over the last two weeks…</p>
            <p className="text-xs text-gray-400 mb-4">Please rate each statement from 0 (At no time) to 5 (All of the time).</p>

            <div className="space-y-5">
              {WHO5_QUESTIONS.map((q, qi) => (
                <div key={q.key} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <p className="text-sm font-medium text-gray-800 mb-3">
                    <span className="text-[#264d44] font-bold mr-1">{qi + 1}.</span> {q.text}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SCALE.map(opt => {
                      const selected = answers[q.key] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAnswers(a => ({ ...a, [q.key]: opt.value }))}
                          className={`text-xs px-3 py-2 rounded-lg border transition-all text-left ${
                            selected
                              ? 'bg-[#264d44] text-white border-[#264d44] font-semibold'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[#264d44] hover:text-[#264d44]'
                          }`}
                        >
                          <span className="font-bold">{opt.value}</span> — {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Submit Check-In'}
          </Button>
        </form>
      </div>
    </div>
  );
}