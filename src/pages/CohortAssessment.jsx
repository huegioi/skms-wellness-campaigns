import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react';
import { getOrderedInstruments, FULL_BATTERY } from '@/components/assessments/instrumentDefs';
import InstrumentStep from '@/components/assessments/InstrumentStep';

const TIMING_MAP = {
  day0:              { survey_type: 'challenge_day0',      label: 'Day 0 Baseline' },
  day14:             { survey_type: 'challenge_day14',     label: 'Day 14 Check-In' },
  cohort_start:      { survey_type: 'cohort_start',         label: 'Cohort Start Census' },
  cohort_end:        { survey_type: 'cohort_end',           label: 'Cohort End Census' },
  cohort_1mo:        { survey_type: 'cohort_1mo',           label: '30-Day Follow-Up' },
  enps_post_session: { survey_type: 'enps_post_session',    label: 'Post-Session Feedback' },
};

export default function CohortAssessmentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('t');
  const service_id = searchParams.get('service_id') || '';
  const client_id = searchParams.get('client_id') || '';
  const proposal_id = searchParams.get('proposal_id') || '';
  const event_id = searchParams.get('event_id') || '';
  const timing = searchParams.get('timing') || 'day0';

  // ── Token resolution ──
  const { data: tokenData, isLoading: tokenLoading, error: tokenError } = useQuery({
    queryKey: ['survey-token', token],
    queryFn: async () => {
      if (!token) return null;
      const res = await base44.functions.invoke('resolveSurveyToken', { token });
      return res.data;
    },
    enabled: !!token,
  });

  // Derive effective params from token or query string
  const effectiveServiceId = tokenData?.service_id || service_id;
  const effectiveClientId = tokenData?.client_id || client_id;
  const effectiveSurveyType = tokenData?.survey_type || TIMING_MAP[timing]?.survey_type || 'challenge_day0';
  // Token invites carry the stored survey_type (e.g. challenge_day0), which is a
  // TIMING_MAP value rather than a key — look it up either way.
  const timingLabel = tokenData
    ? (TIMING_MAP[tokenData.survey_type]?.label
        || Object.values(TIMING_MAP).find(t => t.survey_type === tokenData.survey_type)?.label
        || 'Survey')
    : (TIMING_MAP[timing]?.label || 'Survey');

  // Shown inside the SkillfulMeans Challenges app's welcome screen (an iframe)
  // rather than opened on its own. The app supplies its own heading, so the
  // blue header is dropped, and the page tells the app when it's done.
  const embedded = typeof window !== 'undefined' && window.self !== window.top;
  // Full-height pages on their own; in a frame, only as tall as the content.
  const centered = embedded ? 'py-8' : 'min-h-screen';

  // Fetch service (for display name + challenge instruments)
  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ['cohort-service', effectiveServiceId],
    queryFn: async () => {
      if (!effectiveServiceId) return null;
      const res = await base44.entities.Service.filter({ id: effectiveServiceId });
      return res[0] || null;
    },
    enabled: !!effectiveServiceId,
  });

  // Determine instruments
  let instrumentKeys;
  if (tokenData) {
    instrumentKeys = tokenData.instruments?.length ? tokenData.instruments : ['enps'];
  } else {
    const isCensus = timing === 'cohort_start' || timing === 'cohort_end';
    instrumentKeys = isCensus
      ? FULL_BATTERY
      : (service?.included_assessments?.length ? service.included_assessments : ['who5']);
  }
  // A baseline is taken before anyone has experienced the programme, so eNPS
  // ("would you recommend this program?") has nothing to measure yet.
  if (effectiveSurveyType === 'challenge_day0' || effectiveSurveyType === 'cohort_start') {
    instrumentKeys = instrumentKeys.filter(k => k !== 'enps');
    if (instrumentKeys.length === 0) instrumentKeys = ['who5'];
  }
  const instruments = getOrderedInstruments(instrumentKeys);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Prefill email from token
  useEffect(() => {
    if (tokenData?.email) setEmail(tokenData.email);
  }, [tokenData]);

  // Legacy enps_post_session tokens predate the Pulse form — redirect them to the
  // working AttendeeForm (which submits via submitFeedbackResponse) so old email
  // links land on a functioning survey instead of a 400 from submitCohortAssessment.
  useEffect(() => {
    if (tokenData?.survey_type === 'enps_post_session' && token) {
      navigate(`/AttendeeForm?t=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [tokenData, token, navigate]);

  // Embedded: tell the Challenges app this check-in is done (just a flag and
  // the survey type — never any answers), and report the page height so the
  // app can size the frame to fit instead of scrolling inside it.
  useEffect(() => {
    if (!embedded) return;
    if (submitted || tokenData?.already_submitted) {
      window.parent.postMessage({ type: 'skms-survey-submitted', survey_type: effectiveSurveyType }, '*');
    }
  }, [embedded, submitted, tokenData?.already_submitted, effectiveSurveyType]);

  // Report the height of the content itself (the element marked
  // data-skms-survey), not the body: in a frame the page drops min-h-screen,
  // so the height can shrink as well as grow and the app's frame always fits
  // exactly — one scrollbar, the app's, never one inside the frame.
  useEffect(() => {
    if (!embedded) return;
    document.documentElement.style.overflow = 'hidden';
    let last = 0;
    let timer = 0;
    // A short timer rather than requestAnimationFrame, which never fires while
    // the page is in a background tab.
    const measure = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const el = document.querySelector('[data-skms-survey]');
        const h = Math.ceil(el ? el.getBoundingClientRect().height : document.body.scrollHeight);
        if (h && h !== last) {
          last = h;
          window.parent.postMessage({ type: 'skms-survey-height', height: h }, '*');
        }
      }, 30);
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    let watched = null;
    const watch = () => {
      const el = document.querySelector('[data-skms-survey]');
      if (ro && el && el !== watched) {
        if (watched) ro.unobserve(watched);
        ro.observe(el);
        watched = el;
      }
      measure();
    };
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    watch();
    return () => {
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
  }, [embedded]);

  // A new step starts at the top: let the app bring the frame's top into view
  // if the person had scrolled past it answering the last step.
  useEffect(() => {
    if (embedded) window.parent.postMessage({ type: 'skms-survey-step', step: stepIndex }, '*');
  }, [embedded, stepIndex]);

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
            client_id: effectiveClientId,
            service_id: effectiveServiceId,
            proposal_id,
            event_id: tokenData?.event_id || event_id || undefined,
            participant_email: email.trim(),
            participant_phone: phone.trim() || undefined,
            survey_type: effectiveSurveyType,
            instrument: inst.key,
            item_responses: answers[inst.key],
          })
        )
      );
      if (results.every(r => r?.data?.success)) {
        setSubmitted(true);
        // Mark SurveyInvite as submitted if token was used
        if (token) {
          try {
            await base44.functions.invoke('resolveSurveyToken', { token, mark_submitted: true });
          } catch { /* non-critical */ }
        }
      } else {
        const firstError = results.find(r => r?.data?.error);
        setError(firstError?.data?.error || 'Some submissions failed. Please try again.');
      }
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.');
    }
    setSubmitting(false);
  };

  // Loading gate
  if ((token && tokenLoading) || (!tokenData && !effectiveServiceId && serviceLoading)) {
    return (
      <div data-skms-survey className={`${centered} bg-[#f4f0e9] flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 text-[#264d44] animate-spin" />
      </div>
    );
  }

  // Token error
  if (token && tokenError) {
    return (
      <div data-skms-survey className={`${centered} bg-[#f4f0e9] flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-600">This survey link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  // Already submitted
  if (tokenData?.already_submitted) {
    return (
      <div data-skms-survey className={`${centered} bg-[#f4f0e9] flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-[#264d44] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Already submitted</h2>
          <p className="text-gray-600">You've already completed this survey. Thank you!</p>
        </div>
      </div>
    );
  }

  if (instruments.length === 0) {
    return (
      <div data-skms-survey className={`${centered} bg-[#f4f0e9] flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-600">No assessments configured for this check-in.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div data-skms-survey className={`${centered} bg-[#f4f0e9] flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-[#264d44] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-600">Your {timingLabel} responses have been recorded.</p>
          {!embedded && <p className="text-sm text-gray-400 mt-4">You may close this window.</p>}
        </div>
      </div>
    );
  }

  const progress = (stepIndex / instruments.length) * 100;

  return (
    <div data-skms-survey className={`${embedded ? 'pb-2' : 'min-h-screen'} bg-[#f4f0e9]`}>
      {!embedded && (
      <div className="bg-[#013f7c] text-white px-4 py-6 text-center">
        <img
          src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
          alt="SkillfulMeans"
          className="h-10 mx-auto mb-3"
        />
        <h1 className="text-xl font-bold">{timingLabel}</h1>
        {(service || tokenData?.service_name) && (
          <p className="text-blue-200 text-sm mt-2 font-medium">{service?.name || tokenData?.service_name}</p>
        )}
      </div>
      )}

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
          <div className="h-full bg-[#013f7c] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {stepIndex === 0 ? (
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
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full"
                    disabled={!!tokenData}
                  />
                  {tokenData && (
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
              {!embedded && (
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
              )}
              <Button
                onClick={() => setStepIndex(1)}
                disabled={!canProceed}
                className="w-full bg-[#264d44] hover:bg-[#1d3b34] text-white py-3 text-base font-semibold rounded-xl disabled:opacity-40"
              >
                Begin <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          ) : (
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
                <Button onClick={() => setStepIndex(stepIndex - 1)} variant="outline" className="px-4 py-3 rounded-xl">
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