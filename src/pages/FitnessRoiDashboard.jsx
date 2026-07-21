import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle } from 'lucide-react';
import ResponseTracker from '@/components/fitnessroi/dashboard/ResponseTracker';
import ReminderButton from '@/components/fitnessroi/dashboard/ReminderButton';
import CopyLinkCard from '@/components/fitnessroi/dashboard/CopyLinkCard';
import ResultsView from '@/components/fitnessroi/ResultsView';

export default function FitnessRoiDashboard() {
  const [searchParams] = useSearchParams();
  const magicKey = searchParams.get('k');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!magicKey) { setLoading(false); return; }
    (async () => {
      try {
        const res = await base44.functions.invoke('getJourneyDashboard', { magic_key: magicKey });
        if (res.data?.success) setData(res.data);
      } catch {}
      setLoading(false);
    })();
  }, [magicKey]);

  const surveyUrl = data ? `${window.location.origin}/MfsJourneySurvey?token=${data.survey_token}` : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Loader2 className="w-6 h-6 text-[#0f766e] animate-spin" />
      </div>
    );
  }

  if (!magicKey || !data) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center px-5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#4a2040] mb-2">Check your email for your private link</h1>
          <p className="text-sm text-stone-500">We sent a private dashboard link when you completed your assessment. Use that link to access your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1">Your dashboard</p>
          <h1 className="text-2xl font-bold text-[#4a2040]">{data.company_name ? data.company_name : 'Your team'}</h1>
        </div>
        <ResponseTracker count={data.response_count} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReminderButton magicKey={magicKey} reminderSentAt={data.reminder_sent_at} />
          <CopyLinkCard surveyUrl={surveyUrl} />
        </div>
        <div className="pt-4 border-t border-stone-200">
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-4">Your quick results</p>
          <ResultsView data={{ quick_scores: data.quick_scores, roi_snapshot: data.roi_snapshot, magic_key: magicKey }} hideCta />
        </div>
      </div>
    </div>
  );
}