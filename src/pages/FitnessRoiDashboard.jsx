import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle } from 'lucide-react';
import DashboardControlsBar from '@/components/fitnessroi/dashboard/DashboardControlsBar';
import ResultsView from '@/components/fitnessroi/ResultsView';
import PairedDials from '@/components/fitnessroi/dashboard/PairedDials';
import PairedDomainBars from '@/components/fitnessroi/dashboard/PairedDomainBars';
import RoiComparison from '@/components/fitnessroi/dashboard/RoiComparison';
import DomainOpportunityCards from '@/components/fitnessroi/dashboard/DomainOpportunityCards';
import StrategySessionCta from '@/components/fitnessroi/dashboard/StrategySessionCta';
import ComparisonLegend from '@/components/fitnessroi/dashboard/ComparisonLegend';
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
      <p className="text-xs text-stone-500 mt-2 leading-relaxed">This is your private dashboard — only you have this link. It updates live as your team responds, and you can return any time using the link we emailed you.</p>
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
          <DashboardControlsBar
            count={data.response_count}
            surveyUrl={surveyUrl}
            magicKey={magicKey}
            reminderSentAt={data.reminder_sent_at}
          />
          {/* Section 1: Headline + paired dials + paired bars */}
          <div className="bg-white rounded-2xl border border-stone-200 border-l-4 border-l-[#0f766e] p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#4a2040] mb-1">Your view vs. your team's reality</h2>
            <p className="text-xs text-stone-500 mb-5 leading-relaxed">
              Each domain is scored 0–100 (higher is better) with Low, Typical, and High bands from published research norms. The paired markers show where you placed your team next to where they placed themselves — gaps between the two are the most valuable signal on this page.
            </p>
            <p className="text-xs uppercase tracking-widest text-stone-400 font-semibold text-center mb-1">Mental Fitness Score</p>
            <p className="text-sm font-bold text-[#4a2040] text-center mb-1">
              You estimated {leaderComposite != null ? Math.round(leaderComposite) : '—'}. Your team says {teamComposite != null ? Math.round(teamComposite) : '—'}.
            </p>
            <p className="text-xs text-stone-400 text-center italic mb-4">Perception vs. measured.</p>
            <div className="mb-5">
              <PairedDials leaderScore={leaderComposite} teamScore={teamComposite} />
            </div>
            <ComparisonLegend />
            <div className="mt-6 pt-4 border-t border-stone-100">
              <PairedDomainBars leaderScores={data.quick_scores} teamScores={data.team_scores} />
            </div>
          </div>
          {/* Methodology */}
          <MethodologyNote />
          {/* Section 2: ROI comparison */}
          <RoiComparison
            preliminaryRoi={data.preliminary_roi}
            teamRoi={data.team_roi}
            roiInputs={data.roi_snapshot?.inputs}
            stressRateReal={data.stress_rate_real}
            leaderScores={data.quick_scores}
            teamScores={data.team_scores}
          />
          {/* Section 3: Campaign cards */}
          <DomainOpportunityCards domains={data.domain_opportunity} services={data.services} />
          {/* Section 4: Single CTA */}
          <StrategySessionCta />
        </div>
      </div>
    );
  }

  // ── Pre-results state ──
  return (
    <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <Header />
        <DashboardControlsBar
          count={data.response_count}
          surveyUrl={surveyUrl}
          magicKey={magicKey}
          reminderSentAt={data.reminder_sent_at}
        />
        <div>
          <h2 className="text-lg font-bold text-[#4a2040] mb-1">Team responses</h2>
          <p className="text-xs text-stone-500 mb-4 leading-relaxed">
            Your team's survey is out. When at least 5 people have responded, this dashboard unlocks your team's real scores — the 5-person minimum protects individual anonymity. We'll also nudge you automatically on day 3 and day 7 if you haven't hit 5 yet.
          </p>
        </div>
        <div className="pt-4 border-t border-stone-200">
          <h2 className="text-lg font-bold text-[#4a2040] mb-1">While you wait — your preliminary snapshot</h2>
          <p className="text-xs text-stone-500 mb-4 leading-relaxed">
            These are the scores and ROI projection from your quick assessment. Once your team responds, you'll see how your read compares to theirs.
          </p>
          <ResultsView data={{ quick_scores: data.quick_scores, roi_snapshot: data.roi_snapshot, magic_key: magicKey }} hideCta />
        </div>
      </div>
    </div>
  );
}