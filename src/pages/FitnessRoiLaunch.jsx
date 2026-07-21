import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle } from 'lucide-react';
import PrivacyEducation from '@/components/fitnessroi/launch/PrivacyEducation';
import EmailPreviewModal from '@/components/fitnessroi/launch/EmailPreviewModal';
import SurveyPreviewModal from '@/components/fitnessroi/launch/SurveyPreviewModal';
import SendOptions from '@/components/fitnessroi/launch/SendOptions';
import LaunchConfirmation from '@/components/fitnessroi/launch/LaunchConfirmation';

export default function FitnessRoiLaunch() {
  const [searchParams] = useSearchParams();
  const magicKey = searchParams.get('k');
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState(null);
  const [launched, setLaunched] = useState(null);

  useEffect(() => {
    if (!magicKey) { setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('resolveMfsJourneyKey', { magic_key: magicKey });
        if (res.data?.success) setJourney(res.data);
      } catch {}
      setLoading(false);
    })();
  }, [magicKey]);

  const surveyUrl = journey ? `${window.location.origin}/MfsJourneySurvey?token=${journey.survey_token}` : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Loader2 className="w-6 h-6 text-[#0f766e] animate-spin" />
      </div>
    );
  }

  if (!magicKey || !journey) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#4a2040] mb-2">Check your email for your private link</h1>
          <p className="text-sm text-stone-500">We sent a private dashboard link when you completed your assessment. Use that link to launch your team survey.</p>
        </div>
      </div>
    );
  }

  if (launched) {
    return (
      <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-lg mx-auto px-5 py-12">
          <LaunchConfirmation magicKey={magicKey} mode={launched.mode} sentCount={launched.sent_count} suppressedCount={launched.suppressed_count} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-lg mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1">Launch your team assessment</p>
          <h1 className="text-2xl font-bold text-[#4a2040]">{journey.company_name ? journey.company_name : 'Your team'} is ready to go</h1>
        </div>
        <PrivacyEducation />
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[#4a2040]">Preview before sending</h2>
          <EmailPreviewModal companyName={journey.company_name} surveyUrl={surveyUrl} />
          <SurveyPreviewModal />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-[#4a2040]">Send to your team</h2>
          <SendOptions magicKey={magicKey} surveyUrl={surveyUrl} onLaunched={setLaunched} />
        </div>
      </div>
    </div>
  );
}