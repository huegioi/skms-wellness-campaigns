import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, Video, Calendar } from 'lucide-react';
import CheckinAssessmentSurvey from '@/components/checkin/CheckinAssessmentSurvey';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

export default function Checkin() {
  const [token, setToken] = useState('');
  const [eventInfo, setEventInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [meetingLink, setMeetingLink] = useState(null);
  const [checkedInNoLink, setCheckedInNoLink] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [kioskSuccess, setKioskSuccess] = useState(false);
  const [surveyData, setSurveyData] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get('t');
    if (!t) {
      setError('Missing check-in token.');
      setLoading(false);
      return;
    }
    setToken(t);
    setKiosk(urlParams.get('kiosk') === '1');
    base44.functions.invoke('getCheckinEvent', { token: t })
      .then(res => {
        setEventInfo(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Event not found or link expired.');
        setLoading(false);
      });
  }, []);

  const goToVideoHandoff = (link) => {
    if (!link) {
      setCheckedInNoLink(true);
      return;
    }
    setMeetingLink(link);
  };

  const resetForKiosk = () => {
    setName('');
    setEmail('');
    setSubmitError('');
    setSurveyData(null);
    setKioskSuccess(true);
    setTimeout(() => setKioskSuccess(false), 2500);
  };

  const handleSurveyDone = (link) => {
    setSurveyData(null);
    if (kiosk) {
      resetForKiosk();
    } else {
      goToVideoHandoff(link);
    }
  };

  const handleSurveySkip = (link) => {
    setSurveyData(null);
    if (kiosk) {
      resetForKiosk();
    } else {
      goToVideoHandoff(link);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await base44.functions.invoke('submitCheckin', { token, name, email });
      const link = res.data?.meeting_link || null;

      // Check if assessment survey is needed — call the backend for any non-none
      // timing and let it decide (it returns needs_survey:false when there's
      // nothing to collect). Keep fail-open behavior on error.
      const timing = eventInfo?.assessment_timing || 'none';

      if (timing !== 'none') {
        try {
          const checkRes = await base44.functions.invoke('checkCheckinAssessment', { token, email });
          if (checkRes.data?.needs_survey) {
            setSurveyData(checkRes.data);
            setSubmitting(false);
            return; // Show survey — don't redirect yet
          }
        } catch {
          // If check fails, fail open to the call
        }
      }

      // No survey needed — proceed to call
      if (kiosk) {
        resetForKiosk();
      } else if (link) {
        goToVideoHandoff(link);
      } else {
        // No meeting link — show "checked in, host will share link" state
        setCheckedInNoLink(true);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
      ' at ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#013f7c] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-12 w-auto mx-auto mb-6" />
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-400 mt-2">Please contact your session host for the correct link.</p>
        </div>
      </div>
    );
  }

  // Survey step — shown after check-in when assessment is needed
  if (surveyData) {
    return (
      <CheckinAssessmentSurvey
        token={token}
        name={name}
        email={email}
        surveyData={surveyData}
        onDone={handleSurveyDone}
        onSkip={handleSurveySkip}
      />
    );
  }

  if (kioskSuccess) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-12 w-auto mx-auto mb-6" />
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800">✓ You're checked in — welcome!</h1>
        </div>
      </div>
    );
  }

  if (meetingLink) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-12 w-auto mx-auto mb-6" />
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">You're checked in!</h1>
          <p className="text-gray-500 mb-6">Tap below to join your session.</p>
          <a
            href={meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full bg-[#013f7c] hover:bg-[#012d5a] text-white font-semibold py-4 px-6 rounded-xl text-base transition-colors"
          >
            <Video className="w-5 h-5" />
            Join the session
          </a>
        </div>
      </div>
    );
  }

  if (checkedInNoLink) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-12 w-auto mx-auto mb-6" />
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">You're checked in!</h1>
          <p className="text-gray-500">Your host will share the video link shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <img src={LOGO_URL} alt="SkillfulMeans" className="h-12 w-auto mx-auto mb-6" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <Calendar className="w-3.5 h-3.5" /> Session Check-in
          </div>
          <h1 className="text-xl font-bold text-[#013f7c] mb-1">{eventInfo?.title}</h1>
          {eventInfo?.start_date && (
            <p className="text-sm text-gray-500">{fmtDate(eventInfo.start_date)}</p>
          )}
          {eventInfo?.client_company && (
            <p className="text-sm text-gray-400 mt-1">Hosted for {eventInfo.client_company}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Work email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          {submitError && <p className="text-sm text-red-500">{submitError}</p>}
          <Button type="submit" disabled={submitting} className="w-full bg-[#013f7c] hover:bg-[#012d5a] text-white">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join session'}
          </Button>
        </form>
      </div>
    </div>
  );
}