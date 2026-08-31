import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Brain, Copy, BarChart3, Users, Lock, Unlock, TrendingUp, MoreVertical, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeInstrument } from '@/lib/mfsScore';
import ClientsSubNav from '@/components/clients/ClientsSubNav.jsx';
import JourneyAssessmentTable from '@/components/assessments/JourneyAssessmentTable.jsx';
import AssessmentShareCard from '@/components/assessments/AssessmentShareCard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

export default function Assessments() {
  const navigate = useNavigate();
  const [showDemo, setShowDemo] = useState(false);

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['mfs-assessments-all'],
    queryFn: () => base44.entities.MfsAssessment.list('-created_date', 200),
    staleTime: 30_000,
  });

  const { data: cohortRecords = [] } = useQuery({
    queryKey: ['mfs-cohort-all'],
    queryFn: () => base44.entities.CohortAssessment.filter({ survey_type: 'mfs' }, '-submitted_at', 500),
    staleTime: 30_000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-mfs'],
    queryFn: () => base44.entities.Client.list('-created_date'),
    staleTime: 60_000,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners-for-mfs'],
    queryFn: () => base44.entities.ReferralPartner.filter({ is_active: true }, 'name'),
    staleTime: 60_000,
  });

  const { data: journeys = [] } = useQuery({
    queryKey: ['mfs-journeys-all'],
    queryFn: () => base44.entities.MfsJourney.list('-created_date', 200),
    staleTime: 30_000,
  });

  const origin = window.location.origin;

  const byClient = useMemo(() => {
    const map = {};
    for (const r of cohortRecords) {
      if (!r.client_id) continue;
      const sid = r.instrument_subscores?._sid;
      if (!sid) continue;
      if (!map[r.client_id]) map[r.client_id] = {};
      if (!map[r.client_id][sid]) map[r.client_id][sid] = {};
      map[r.client_id][sid][r.instrument] = r;
    }
    return map;
  }, [cohortRecords]);

  const clientMap = useMemo(() => {
    const map = {};
    for (const c of clients) map[c.id] = c;
    return map;
  }, [clients]);

  const partnerMap = useMemo(() => {
    const map = {};
    for (const p of partners) map[p.unique_portal_id] = p;
    return map;
  }, [partners]);

  const assessmentData = useMemo(() => {
    return assessments.map(a => {
      const submissions = byClient[a.client_id] || {};
      const responseCount = Object.keys(submissions).length;
      const locked = responseCount < 5;

      let composite = null;
      if (!locked) {
        const perRespondent = [];
        for (const sid of Object.keys(submissions)) {
          const scores = [];
          for (const key of ['who5', 'pss4', 'uwes3', 'ucla3']) {
            const row = submissions[sid][key];
            if (!row) continue;
            const norm = normalizeInstrument(key, row.item_responses);
            if (norm != null) scores.push(norm);
          }
          if (scores.length > 0) perRespondent.push(scores.reduce((s, v) => s + v, 0) / scores.length);
        }
        if (perRespondent.length > 0) composite = perRespondent.reduce((s, v) => s + v, 0) / perRespondent.length;
      }

      const client = clientMap[a.client_id];
      const partner = a.ref ? partnerMap[a.ref] : null;
      const partnerName = partner?.name || client?.referral_partner_name || '';
      const converted = client ? !client.is_assessment_lead : false;

      return { ...a, responseCount, locked, composite, partnerName, converted, client };
    });
  }, [assessments, byClient, clientMap, partnerMap]);

  const journeyData = useMemo(() => {
    return journeys.map(j => {
      const submissions = byClient[j.client_id] || {};
      const responseCount = Object.keys(submissions).length;
      const locked = responseCount < 5;
      const composite = j.quick_scores?.composite ?? null;
      const partner = j.ref ? partnerMap[j.ref] : null;
      const partnerName = partner?.name || '';
      const client = clientMap[j.client_id];
      return { ...j, responseCount, locked, composite, partnerName, client };
    });
  }, [journeys, byClient, clientMap, partnerMap]);

  const visibleAssessments = showDemo ? assessmentData : assessmentData.filter(a => !a.is_demo);
  const visibleJourneys = showDemo ? journeyData : journeyData.filter(j => !j.is_demo);

  const stats = useMemo(() => {
    const total = visibleAssessments.length;
    const totalResponses = visibleAssessments.reduce((s, a) => s + a.responseCount, 0);
    const gated = visibleAssessments.filter(a => a.locked).length;
    const unlocked = total - gated;
    const conversions = visibleAssessments.filter(a => a.converted).length;
    return { total, totalResponses, gated, unlocked, conversions };
  }, [visibleAssessments]);

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9]">
        <ClientsSubNav activePage="Assessments" />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      <ClientsSubNav activePage="Assessments" />

      <div className="mx-auto px-4 md:px-8 py-6 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={Brain} label="Assessments" value={stats.total} color="#7c3aed" />
          <StatCard icon={Users} label="Responses" value={stats.totalResponses} color="#013f7c" />
          <StatCard icon={Lock} label="Gated" value={stats.gated} color="#d97706" />
          <StatCard icon={Unlock} label="Unlocked" value={stats.unlocked} color="#059669" />
          <StatCard icon={TrendingUp} label="Converted" value={stats.conversions} color="#264d44" />
        </div>

        <AssessmentShareCard
          title="The Mental Fitness Score"
          subtitle="Free assessment — share it anywhere"
          url="https://app.skillfulmeans.life/MentalFitnessScore"
          shareTitle="The Mental Fitness Score"
          shareText="Get your team's free Mental Fitness Score — 3 minutes per employee, fully anonymous"
          accentColor="purple"
          icon={Brain}
          qrTitle="The Mental Fitness Score"
          qrSubtitle="Scan to start the free assessment"
        />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#264d44]">All Assessments</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <Switch checked={showDemo} onCheckedChange={setShowDemo} />
            Show demo
          </label>
        </div>

        {visibleAssessments.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow">
            <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No assessments yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 px-4 font-medium">Company</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Created</th>
                  <th className="py-3 px-4 font-medium text-center">Responses</th>
                  <th className="py-3 px-4 font-medium">Score</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Status</th>
                  <th className="py-3 px-4 font-medium hidden lg:table-cell">Partner</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssessments.map(a => {
                  const surveyUrl = `${origin}/MfsSurvey?t=${a.token}`;
                  const resultsUrl = `${origin}/MfsResults?t=${a.token}`;
                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-800">{a.company_name || '—'}</span>
                          {a.is_demo && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">DEMO</span>}
                          {a.converted && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Converted</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-700">{a.contact_name || '—'}</div>
                        <div className="text-xs text-gray-400 max-w-[180px] truncate">{a.contact_email}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">
                        {new Date(a.created_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-medium text-gray-700">
                        {a.responseCount}
                      </td>
                      <td className="py-3 px-4">
                        {a.locked ? (
                          <span className="text-xs text-amber-600 font-medium">gated · {a.responseCount} of 5</span>
                        ) : (
                          <span className="text-sm font-bold text-[#264d44]">{Math.round(a.composite)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 hidden lg:table-cell">
                        {a.partnerName || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button aria-label="Row actions" className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 rounded-lg hover:bg-gray-100">
                              <MoreVertical className="w-4 h-4 text-gray-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(resultsUrl, '_blank')}>
                              <BarChart3 className="w-4 h-4 mr-2" /> Open results
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(surveyUrl)}>
                              <Copy className="w-4 h-4 mr-2" /> Copy survey link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(resultsUrl)}>
                              <Copy className="w-4 h-4 mr-2" /> Copy results link
                            </DropdownMenuItem>
                            {a.client && (
                              <DropdownMenuItem onClick={() => navigate(`/Clients?clientId=${a.client.id}`)}>
                                <Users className="w-4 h-4 mr-2" /> Open client
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ROI Journeys ── */}
        <div className="flex items-center justify-between mb-4 mt-8">
          <h2 className="text-lg font-bold text-[#264d44] flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#0f766e]" />
            Mental Fitness Journeys
          </h2>
        </div>

        <AssessmentShareCard
          title="The Mental Fitness Journey"
          subtitle="ROI projection + team assessment — share it anywhere"
          url="https://app.skillfulmeans.life/FitnessRoi"
          shareTitle="The Mental Fitness Journey"
          shareText="See your team's mental fitness ROI — 3-minute quick assessment, free"
          accentColor="teal"
          icon={TrendingUp}
          qrTitle="The Mental Fitness Journey"
          qrSubtitle="Scan to start your journey"
        />

        <JourneyAssessmentTable journeys={visibleJourneys} origin={origin} copyLink={copyLink} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}