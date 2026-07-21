import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle } from 'lucide-react';
import ResponseTracker from '@/components/fitnessroi/dashboard/ResponseTracker';
import ReminderButton from '@/components/fitnessroi/dashboard/ReminderButton';
import CopyLinkCard from '@/components/fitnessroi/dashboard/CopyLinkCard';
import ResultsView from '@/components/fitnessroi/ResultsView';
import PairedDials from '@/components/fitnessroi/dashboard/PairedDials';
import PairedDomainBars from '@/components/fitnessroi/dashboard/PairedDomainBars';
import RoiComparison from '@/components/fitnessroi/dashboard/RoiComparison';
import DomainOpportunityCards from '@/components/fitnessroi/dashboard/DomainOpportunityCards';
import BookCallCta from '@/components/fitnessroi/dashboard/BookCallCta';
import MethodologyNote from '@/components/fitnessroi/dashboard/MethodologyNote';

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
  const unlocked = data?.team_scores != null;

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

  const Header = () => (
    <div>
      <p className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-1">Your dashboard</p>
      <h1 className="text-2xl font-bold text-[#4a2040]">{data.company_name ? data.company_name : 'Your team'}</h1>
    </div>
  );

  const BottomControls = () => (
    <div className="pt-4 border-t border-stone-200 space-y-4">
      <ResponseTracker count={data.response_count} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReminderButton magicKey={magicKey} reminderSentAt={data.reminder_sent_at} />
        <CopyLinkCard surveyUrl={surveyUrl} />
      </div>
    </div>
  );

  // ── Unlocked state ──
  if (unlocked) {
    const leaderComposite = data.quick_scores?.composite;
    const teamComposite = data.team_scores?.composite;
    return (
      <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
          <Header />
          {/* Section 1: Headline + paired dials + paired bars */}
          <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#4a2040] mb-1 text-center">
              You estimated {leaderComposite != null ? Math.round(leaderComposite) : '—'}. Your team says {teamComposite != null ? Math.round(teamComposite) : '—'}.
            </h2>
            <p className="text-xs text-stone-400 text-center italic mb-5">Perception vs. measured.</p>
            <PairedDials leaderScore={leaderComposite} teamScore={teamComposite} />
            <div className="mt-6 pt-4 border-t border-stone-100">
              <PairedDomainBars leaderScores={data.quick_scores} teamScores={data.team_scores} />
            </div>
          </div>
          {/* Section 2: ROI comparison */}
          <RoiComparison
            preliminaryRoi={data.preliminary_roi}
            teamRoi={data.team_roi}
            estimatedStressRate={data.roi_snapshot?.inputs?.stressRate}
            realStressRate={data.stress_rate_real}
          />
          {/* Section 3: Domain opportunity */}
          <DomainOpportunityCards domains={data.domain_opportunity} services={data.services} />
          {/* Section 4: Book a call CTA */}
          <BookCallCta magicKey={magicKey} />
          {/* Section 5: Methodology */}
          <MethodologyNote />
          {/* Bottom controls */}
          <BottomControls />
        </div>
      </div>
    );
  }

  // ── Pre-results state ──
  return (
    <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <Header />
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