import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ChevronLeft, Video, CheckCircle2 } from 'lucide-react';
import { INSTRUMENTS, getOrderedInstruments } from '@/components/assessments/instrumentDefs';
import InstrumentStep from '@/components/assessments/InstrumentStep';
import { base44 } from '@/api/base44Client';

/**
 * Survey step shown after check-in when the event has assessment_timing ≠ none.
 * Uses the same InstrumentStep component as the CohortAssessment page.
 * Always allows skipping — the redirect to the call is never blocked.
 */
export default function CheckinAssessmentSurvey({ token, name, email, surveyData, onDone, onSkip, kiosk = false }) {
  const { instruments: instrumentKeys, skipped_instruments, service_name, total_questions, meeting_link } = surveyData;
  const instruments = useMemo(() => getOrderedInstruments(instrumentKeys), [instrumentKeys]);

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentInstrument = stepIndex < instruments.length ? instruments[stepIndex] : null;
  const instrumentAnswers = currentInstrument ? (answers[currentInstrument.key] || {}) : {};
  const allCurrentAnswered = currentInstrument
    ? currentInstrument.questions.every(q => instrumentAnswers[q.key] !== undefined)
    : false;
  const isLastStep = stepIndex === instruments.length - 1;

  const setAnswer = (instKey, qKey, value) => {
    setAnswers(a => ({ ...a, [instKey]: { ...(a[instKey] || {}), [qKey]: value } }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submitCheckinAssessment', {
        token, email, name, answers,
      });
      // Always redirect to the call — fail open
      const link = res.data?.meeting_link || meeting_link;
      onDone(link);
    } catch (e) {
      // Fail open — redirect to call even on error
      const link = meeting_link;
      onDone(link);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSkip(meeting_link);
  };

  const JoinNowLink = ({ className = '' }) => (
    <button
      type="button"
      onClick={handleSkip}
      disabled={submitting}
      className={`inline-flex items-center gap-2 text-sm font-semibold text-[#013f7c] hover:text-[#012d5a] transition-colors ${className}`}
    >
      <Video className="w-4 h-4" />
      {kiosk ? 'Skip survey' : 'Join the session now →'}
    </button>
  );

  const progress = ((stepIndex + 1) / instruments.length) * 100;

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white px-4 py-5 text-center">
        <img
          src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
          alt="SkillfulMeans"
          className="h-9 mx-auto mb-2"
        />
        <h1 className="text-lg font-bold">A few quick questions while you wait</h1>
        <p className="text-blue-200 text-sm mt-1">{kiosk ? 'Quick check-in survey before you head in.' : "Then you'll join the call"}</p>
      </div>

      {/* Confidentiality note */}
      <div className="max-w-xl mx-auto px-4 pt-4">
        <div className="bg-white border border-[#013f7c]/15 rounded-xl p-4 text-sm text-gray-700">
          <p className="font-semibold text-[#013f7c] mb-1">Help Us Measure Our Impact</p>
          <p className="mb-2">Your feedback helps SkillfulMeans evaluate the effectiveness of our wellness programs and understand their overall impact on your organization.</p>
          <p className="text-gray-600">All survey responses are confidential. Individual responses are never shared with your employer. Results are reported only in aggregate, ensuring your privacy while helping us improve our programs and demonstrate their value.</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500">
            {service_name && `${service_name} · `}
            Step {stepIndex + 1} of {instruments.length}
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
          {currentInstrument && (
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
                {stepIndex > 0 && (
                  <Button
                    onClick={() => setStepIndex(stepIndex - 1)}
                    variant="outline"
                    className="px-4 py-3 rounded-xl"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                )}
                {isLastStep ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!allCurrentAnswered || submitting}
                    className="flex-1 bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
                  >
                    {submitting
                      ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
                      : <><CheckCircle2 className="w-5 h-5 mr-2" /> {kiosk ? 'Submit' : 'Submit & Join Call'}</>}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStepIndex(stepIndex + 1)}
                    disabled={!allCurrentAnswered}
                    className="flex-1 bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Persistent join-now link — never block a latecomer */}
        <div className="text-center mt-4">
          <JoinNowLink />
        </div>

        {skipped_instruments?.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-3">
            A longer version of this survey includes {skipped_instruments.length} more instrument{skipped_instruments.length !== 1 ? 's' : ''} — we'll send those separately.
          </p>
        )}
      </div>
    </div>
  );
}