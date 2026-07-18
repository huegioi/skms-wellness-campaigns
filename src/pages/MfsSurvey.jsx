import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PortalShell, PortalError } from '@/components/portal/PortalShell';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { INSTRUMENTS } from '@/components/assessments/instrumentDefs';

export default function MfsSurvey() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const [step, setStep] = useState(0); // 0 = WHO-5, 1 = PSS-4, 2 = done
  const [who5, setWho5] = useState({});
  const [pss4, setPss4] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  if (!token) return <PortalError heading="Survey not found" message="This survey link is invalid." />;
  if (error) return <PortalError heading="Survey not found" message="This survey link is invalid or has expired." />;

  // ── Done screen ──
  if (step === 2) {
    return (
      <PortalShell
        accentColor="#264d44"
        title="Mental Fitness Score"
        subtitle="Thank you"
        maxWidth="max-w-lg"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-green-50">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 leading-relaxed max-w-md mx-auto">
            Your responses have been recorded. Your privacy is protected — responses are completely anonymous and aggregated.
          </p>
        </div>
      </PortalShell>
    );
  }

  const instrument = step === 0 ? INSTRUMENTS.who5 : INSTRUMENTS.pss4;
  const answers = step === 0 ? who5 : pss4;
  const setAnswers = step === 0 ? setWho5 : setPss4;
  const allAnswered = instrument.questions.every(q => answers[q.key] != null);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitMfsSurvey', { token, who5, pss4 });
      setStep(2);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell
      accentColor="#013f7c"
      title="Mental Fitness Score"
      subtitle="Anonymous team survey — 3 minutes"
      maxWidth="max-w-2xl"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[0, 1].map(i => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-[#013f7c]' : 'bg-gray-200'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-1">Step {step + 1} of 2</p>
        <h2 className="text-lg font-bold text-gray-800 mb-1">{instrument.label} — {instrument.subtitle}</h2>
        {instrument.preamble && <p className="text-sm text-gray-500 mb-5">{instrument.preamble}</p>}

        <div className="space-y-5">
          {instrument.questions.map(q => (
            <div key={q.key}>
              <p className="text-sm font-medium text-gray-700 mb-2">{q.text}</p>
              <div className="space-y-1.5">
                {instrument.scale.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [q.key]: opt.value })}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      answers[q.key] === opt.value
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
          <Button
            disabled={!allAnswered || submitting}
            onClick={() => step === 0 ? setStep(1) : handleSubmit()}
            className="bg-[#013f7c] hover:bg-[#012d5a] gap-2"
          >
            {submitting ? 'Submitting...' : step === 0 ? 'Next' : 'Submit'}
            {step === 0 && <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}