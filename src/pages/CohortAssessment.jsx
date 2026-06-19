import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getOrderedInstruments, FULL_BATTERY } from '@/components/assessments/instrumentDefs';
import InstrumentStep from '@/components/assessments/InstrumentStep';

const TIMING_MAP = {
  day0:         { survey_type: 'challenge_day0',  label: 'Day 0 Baseline' },
  day14:        { survey_type: 'challenge_day14', label: 'Day 14 Check-In' },
  cohort_start: { survey_type: 'cohort_start',    label: 'Cohort Start Census' },
  cohort_end:   { survey_type: 'cohort_end',      label: 'Cohort End Census' },
};

export default function CohortAssessmentPage() {
  const params = new URLSearchParams(window.location.search);
  const service_id = params.get('service_id') || '';
  const client_id = params.get('client_id') || '';
  const proposal_id = params.get('proposal_id') || '';
  const timing = params.get('timing') || 'day0';
  const { survey_type, label: timingLabel } = TIMING_MAP[timing] || TIMING_MAP['day0'];
  const isCensus = timing === 'cohort_start' || timing === 'cohort_end';

  // Fetch service to read included_assessments (challenge only)
  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ['cohort-service', service_id],
    queryFn: async () => {
      if (!service_id) return null;
      const res = await base44.entities.Service.filter({ id: service_id });
      return res[0] || null;
    },
    enabled: !!service_id,
  });

  // Census always uses the full battery; challenge reads the service config
  const instrumentKeys = isCensus
    ? FULL_BATTERY
    : (service?.included_assessments?.length ? service.included_assessments : ['who5']);
  const instruments = getOrderedInstruments(instrumentKeys);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stepIndex, setStepIndex] = useState(0); // 0 = contact, 1..N = instruments
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const currentInstrument = stepIndex > 0 ? instruments[stepIndex - 1] : null;
  const instrumentAnswers = currentInstrument ? (answers[currentInstrument.key] || {}) : {};
  const allCurrentAnswered = currentInstrument
    ? currentInstrument.questions.every(q => instrumentAnswers[q.key] !== undefined)
    : false;

  const canProceed = stepIndex === 0 ? email.trim().length > 0 : allCurrentAnswered;
  const isLastStep = stepIndex === instruments.length;

  const totalItems = instruments.reduce((s, i) => s + i.questions.length, 0);
  const estMinutes = Math.max(1, Math.ceil(totalItems * 5 / 60));

  const setAnswer = (instKey, qKey, value) => {
    setAnswers(a => ({ ...a, [instKey]: { ...(a[instKey] || {}), [qKey]: value } }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const results = await Promise.all(
        instruments.map(inst =>
          base44.functions.invoke('submitCohortAssessment', {
            client_id,
            service_id,
            proposal_id,
            participant_email: email.trim(),
            participant_phone: phone.trim() || undefined,
            survey_type,
            instrument: inst.key,
            item_responses: answers[inst.key],
          })
        )
      );
      if (results.every(r => r?.data?.success)) {
        setSubmitted(true);
      } else {
        const firstError = results.find(r => r?.data?.error);
        setError(firstError?.data?.error || 'Some submissions failed. Please try again.');
      }
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.');
    }
    setSubmitting(false);
  };

  // Loading gate for challenge (need service data before rendering)
  if (!isCensus && serviceLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#264d44] animate-spin" />
      </div>
    );
  }

  if (instruments.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-600">No assessments configured for this check-in.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-[#264d44] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-600">Your {timingLabel} responses have been recorded.</p>
          <p className="text-sm text-gray-400 mt-4">You may close this window.</p>
        </div>
      </div>
    );
  }

  const progress = (stepIndex / (instruments.length + 1)) * 100;

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white px-4 py-6 text-center">
        <img
          src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
          alt="SKMS Wellness"
          className="h-10 mx-auto mb-3"
        />
        <h1 className="text-xl font-bold">{timingLabel}</h1>
        {service && <p className="text-blue-200 text-sm mt-2 font-medium">{service.name}</p>}
      </div>

      {/* Progress bar */}
      <div className="max-w-xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500">
            {stepIndex === 0 ? 'Getting started' : `Step ${stepIndex} of ${instruments.length}`}
          </span>
          {currentInstrument && (
            <span className="text-xs font-semibold text-[#013f7c]">{currentInstrument.label}</span>
          )}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#013f7c] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {stepIndex === 0 ? (
            /* ── Contact step ── */
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Let's get started</h2>
                <p className="text-sm text-gray-500">
                  This check-in takes about {estMinutes} minute{estMinutes !== 1 ? 's' : ''}.
                  Your email links your responses across time.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full"
                />
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
              <Button
                onClick={() => setStepIndex(1)}
                disabled={!canProceed}
                className="w-full bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
              >
                Begin <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          ) : (
            /* ── Instrument step ── */
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-[#013f7c] uppercase tracking-wide">
                  {currentInstrument.label} · {currentInstrument.subtitle}
                </p>
              </div>
              <InstrumentStep
                instrument={currentInstrument}
                answers={instrumentAnswers}
                onChange={(qKey, val) => setAnswer(currentInstrument.key, qKey, val)}
              />
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => setStepIndex(stepIndex - 1)}
                  variant="outline"
                  className="px-4 py-3 rounded-xl"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                {isLastStep ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canProceed || submitting}
                    className="flex-1 bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
                  >
                    {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</> : 'Submit All'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStepIndex(stepIndex + 1)}
                    disabled={!canProceed}
                    className="flex-1 bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}