import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { INSTRUMENTS } from '@/components/assessments/instrumentDefs';
import { ShieldCheck, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const SURVEY_STEPS = ['who5', 'pss4', 'uwes3', 'ucla3'];

function InvalidScreen() {
  return (
    <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-md text-center">
        <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#4a2040] mb-2">Survey not found</h1>
        <p className="text-sm text-stone-500">This survey link is invalid or has expired.</p>
      </div>
    </div>
  );
}

export default function MfsJourneySurvey() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (token && localStorage.getItem(`mfj_completed_${token}`)) setStep(SURVEY_STEPS.length);
  }, [token]);

  if (!token) return <InvalidScreen />;
  if (error) return <InvalidScreen />;

  // Thank-you screen
  if (step === SURVEY_STEPS.length) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-md">
          <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#0f766e]/10">
              <CheckCircle className="w-8 h-8 text-[#0f766e]" />
            </div>
            <h2 className="text-xl font-bold text-[#4a2040] mb-2">Thank you!</h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              Your responses have been recorded. Your privacy is fully protected — no name or email was collected, and your answers are combined with your colleagues' into group averages only. No one at your company can see what you answered.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Landing screen
  if (step === -1) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-md">
          <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-[#0f766e]/10">
              <ShieldCheck className="w-6 h-6 text-[#0f766e]" />
            </div>
            <h2 className="text-lg font-bold text-[#4a2040] mb-2">Anonymous. No accounts, no names.</h2>
            <p className="text-sm text-stone-500 leading-relaxed mb-4">
              Your employer only ever sees team-level aggregates, never individual answers. This survey takes about 3 minutes.
            </p>
            <button onClick={() => setStep(0)}
              className="w-full bg-[#0f766e] text-white rounded-full py-3 font-semibold text-sm hover:bg-[#0d6560] transition-colors flex items-center justify-center gap-2">
              Begin <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const instrumentKey = SURVEY_STEPS[step];
  const instrument = INSTRUMENTS[instrumentKey];
  const stepAnswers = answers[instrumentKey] || {};
  const allAnswered = instrument.questions.every(q => stepAnswers[q.key] != null);

  const handleNext = () => {
    if (step < SURVEY_STEPS.length - 1) setStep(step + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitJourneySurvey', { token, ...answers });
      localStorage.setItem(`mfj_completed_${token}`, '1');
      setStep(SURVEY_STEPS.length);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="flex items-center gap-1.5 mb-4 text-xs text-stone-400 justify-center">
          <ShieldCheck className="w-3 h-3" /> 100% anonymous — no name or email collected
        </div>
        <div className="flex items-center justify-center gap-2 mb-6">
          {SURVEY_STEPS.map((s, i) => (
            <div key={s} className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-[#0f766e]' : i < step ? 'w-2 bg-[#0f766e]' : 'w-2 bg-stone-200'}`} />
          ))}
        </div>
        <p className="text-xs text-stone-400 mb-1 text-center">Step {step + 1} of {SURVEY_STEPS.length}</p>
        <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#4a2040] mb-1 text-center">{instrument.label} — {instrument.subtitle}</h2>
          {instrument.preamble && <p className="text-sm text-stone-500 mb-5 text-center">{instrument.preamble}</p>}
          <div className="space-y-5">
            {instrument.questions.map(q => (
              <div key={q.key}>
                <p className="text-sm font-medium text-stone-700 mb-2">{q.text}</p>
                <div className="space-y-1.5">
                  {instrument.scale.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setAnswers({ ...answers, [instrumentKey]: { ...stepAnswers, [q.key]: opt.value } })}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-colors ${
                        stepAnswers[q.key] === opt.value
                          ? 'bg-[#0f766e] text-white border-[#0f766e]'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-[#0f766e]'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-6">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}
            <button disabled={!allAnswered || submitting} onClick={handleNext}
              className="bg-[#0f766e] text-white rounded-full px-6 py-2.5 font-semibold text-sm hover:bg-[#0d6560] transition-colors disabled:opacity-50 flex items-center gap-2">
              {submitting ? 'Submitting...' : step === SURVEY_STEPS.length - 1 ? 'Submit' : 'Next'}
              {step < SURVEY_STEPS.length - 1 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}