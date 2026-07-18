import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PortalShell, PortalError } from '@/components/portal/PortalShell';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { INSTRUMENTS } from '@/components/assessments/instrumentDefs';

const SURVEY_STEPS = ['who5', 'pss4', 'uwes3', 'ucla3'];

export default function MfsSurvey() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const [step, setStep] = useState(-1); // -1 = intro, 0..3 = instruments, 4 = done
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  // localStorage double-submission guard
  useEffect(() => {
    if (token && localStorage.getItem(`mfs_completed_${token}`)) {
      setStep(SURVEY_STEPS.length);
    }
  }, [token]);

  if (!token) return <PortalError heading="Survey not found" message="This survey link is invalid." />;
  if (error) return <PortalError heading="Survey not found" message="This survey link is invalid or has expired." />;

  // ── Thank-you screen ──
  if (step === SURVEY_STEPS.length) {
    return (
      <PortalShell accentColor="#264d44" title="Mental Fitness Score" subtitle="Thank you" maxWidth="max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-green-50">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 leading-relaxed max-w-md mx-auto">
            Your responses have been recorded. Your privacy is fully protected — no name or email was collected, and your answers are combined with your colleagues' into group averages only. No one at your company can see what you answered.
          </p>
        </div>
      </PortalShell>
    );
  }

  // ── Intro screen ──
  if (step === -1) {
    return (
      <PortalShell accentColor="#013f7c" title="Mental Fitness Score" subtitle="Anonymous team survey — 3 minutes" maxWidth="max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5 bg-blue-50">
            <ShieldCheck className="w-7 h-7 text-[#013f7c]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-3">Your responses are 100% anonymous</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            This 4-part survey measures how your team is doing across wellbeing, stress, engagement, and connection. No name, no email, no account — your answers are pooled with your colleagues' and shown only as group averages. No one at your company can see individual responses. It takes about 3 minutes.
          </p>
          <Button onClick={() => setStep(0)} className="w-full bg-[#013f7c] hover:bg-[#012d5a] gap-2">
            Begin Survey <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </PortalShell>
    );
  }

  const instrumentKey = SURVEY_STEPS[step];
  const instrument = INSTRUMENTS[instrumentKey];
  const stepAnswers = answers[instrumentKey] || {};
  const allAnswered = instrument.questions.every(q => stepAnswers[q.key] != null);

  const handleNext = () => {
    if (step < SURVEY_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitMfsSurvey', { token, ...answers });
      localStorage.setItem(`mfs_completed_${token}`, '1');
      setStep(SURVEY_STEPS.length);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell accentColor="#013f7c" title="Mental Fitness Score" subtitle="Anonymous team survey — 3 minutes" maxWidth="max-w-2xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
      <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400 justify-center">
        <ShieldCheck className="w-3 h-3" /> 100% anonymous — no name or email collected
      </div>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {SURVEY_STEPS.map((s, i) => (
            <div key={s} className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-[#013f7c]' : i < step ? 'w-2 bg-[#013f7c]' : 'w-2 bg-gray-200'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-1 text-center">Step {step + 1} of {SURVEY_STEPS.length}</p>
        <h2 className="text-lg font-bold text-gray-800 mb-1 text-center">{instrument.label} — {instrument.subtitle}</h2>
        {instrument.preamble && <p className="text-sm text-gray-500 mb-5 text-center">{instrument.preamble}</p>}

        <div className="space-y-5">
          {instrument.questions.map(q => (
            <div key={q.key}>
              <p className="text-sm font-medium text-gray-700 mb-2">{q.text}</p>
              <div className="space-y-1.5">
                {instrument.scale.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [instrumentKey]: { ...stepAnswers, [q.key]: opt.value } })}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      stepAnswers[q.key] === opt.value
                        ? 'bg-[#013f7c] text-white border-[#013f7c]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#013f7c]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-6">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          ) : <div />}
          <Button disabled={!allAnswered || submitting} onClick={handleNext} className="bg-[#013f7c] hover:bg-[#012d5a] gap-2">
            {submitting ? 'Submitting...' : step === SURVEY_STEPS.length - 1 ? 'Submit' : 'Next'}
            {step < SURVEY_STEPS.length - 1 && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}