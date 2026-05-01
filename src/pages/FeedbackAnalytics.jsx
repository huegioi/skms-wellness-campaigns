import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Loader2, Star, Users, TrendingUp, MessageSquare, ExternalLink, BarChart2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function FeedbackAnalytics() {
  const [selectedSurveyId, setSelectedSurveyId] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const { data: surveys = [] } = useQuery({
    queryKey: ['feedback-surveys'],
    queryFn: () => base44.entities.FeedbackSurvey.list()
  });

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['feedback-responses', selectedSurveyId],
    queryFn: () =>
      selectedSurveyId === 'all'
        ? base44.entities.FeedbackResponse.list('-submitted_at')
        : base44.entities.FeedbackResponse.filter({ survey_id: selectedSurveyId }, '-submitted_at')
  });

  const syncSurvey = async () => {
    setIsSyncing(true);
    try {
      const res = await base44.functions.invoke('syncFeedbackSurvey');
      toast.success(res.data?.message || 'Sync complete!');
      queryClient.invalidateQueries({ queryKey: ['feedback-surveys'] });
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate stats
  const avgRating = responses.length > 0
    ? (responses.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / responses.filter(r => r.overall_rating).length).toFixed(1)
    : null;

  const avgNPS = responses.length > 0
    ? (responses.reduce((sum, r) => sum + (r.nps_score || 0), 0) / responses.filter(r => r.nps_score != null).length).toFixed(1)
    : null;

  const raffleEntries = responses.filter(r => r.raffle_address).length;

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Feedback Analytics</h1>
            <p className="text-gray-600">Workshop participant feedback and insights</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={syncSurvey}
              disabled={isSyncing}
              className="border-[#264d44] text-[#264d44] hover:bg-[#264d44] hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Questions'}
            </Button>
            <a href={createPageUrl('FeedbackForm')} target="_blank" rel="noopener noreferrer">
              <Button className="bg-[#770142] hover:bg-[#5a0132]">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Form
              </Button>
            </a>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6 max-w-xs">
          <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by workshop..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workshops</SelectItem>
              {surveys.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.service_name}
                  {s.sheet_tab && s.sheet_tab !== s.service_name ? ` — ${s.sheet_tab}` : ''}
                  {s.last_synced ? ` (${new Date(s.last_synced).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Responses" value={responses.length} color="#013f7c" />
          <StatCard icon={Star} label="Avg Rating" value={avgRating ? `${avgRating}/5` : '—'} color="#264d44" />
          <StatCard icon={TrendingUp} label="Avg NPS" value={avgNPS ? `${avgNPS}/10` : '—'} color="#770142" />
          <StatCard icon={MessageSquare} label="Raffle Entries" value={raffleEntries} color="#ff9878" />
        </div>

        <Tabs defaultValue="responses">
          <TabsList className="bg-white shadow-md mb-6">
            <TabsTrigger value="responses" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              Responses ({responses.length})
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              Benchmarks
            </TabsTrigger>
            <TabsTrigger value="surveys" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              Surveys ({surveys.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="responses">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : responses.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No responses yet</h3>
                <p className="text-gray-500">Share the feedback form to start collecting responses</p>
              </div>
            ) : (
              <div className="space-y-4">
                {responses.map(response => (
                  <ResponseCard key={response.id} response={response} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="benchmarks">
            <BenchmarksTab responses={responses} surveys={surveys} />
          </TabsContent>

          <TabsContent value="surveys">
            <div className="grid gap-4">
              {surveys.map(survey => (
                <div key={survey.id} className="bg-white rounded-xl shadow-lg p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#264d44' }}>{survey.service_name}</h3>
                      <p className="text-sm text-gray-500">Tab: {survey.sheet_tab} • {(survey.questions || []).length} questions</p>
                      {survey.last_synced && (
                        <p className="text-xs text-gray-400 mt-1">Last synced: {new Date(survey.last_synced).toLocaleString()}</p>
                      )}
                    </div>
                    <Badge className={survey.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                      {survey.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(survey.questions || []).slice(0, 4).map(q => (
                      <Badge key={q.id} variant="secondary" className="text-xs">{q.type}</Badge>
                    ))}
                    {(survey.questions || []).length > 4 && (
                      <Badge variant="secondary" className="text-xs">+{(survey.questions || []).length - 4} more</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BenchmarksTab({ responses, surveys }) {
  // Group responses by service name
  const byService = responses.reduce((acc, r) => {
    const key = r.service_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const overallAvgRating = responses.filter(r => r.overall_rating).length > 0
    ? (responses.reduce((s, r) => s + (r.overall_rating || 0), 0) / responses.filter(r => r.overall_rating).length).toFixed(1)
    : null;

  const overallAvgNPS = responses.filter(r => r.nps_score != null).length > 0
    ? (responses.reduce((s, r) => s + (r.nps_score || 0), 0) / responses.filter(r => r.nps_score != null).length).toFixed(1)
    : null;

  if (responses.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-lg">
        <BarChart2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No data yet</h3>
        <p className="text-gray-500">Benchmarks will appear once feedback responses are collected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall benchmarks */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#013f7c' }}>Overall Benchmarks</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 border text-center">
            <p className="text-3xl font-bold" style={{ color: '#264d44' }}>{overallAvgRating ?? '—'}<span className="text-base font-normal text-gray-400">/5</span></p>
            <p className="text-sm text-gray-500 mt-1">Avg Rating (all services)</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border text-center">
            <p className="text-3xl font-bold" style={{ color: '#013f7c' }}>{overallAvgNPS ?? '—'}<span className="text-base font-normal text-gray-400">/10</span></p>
            <p className="text-sm text-gray-500 mt-1">Avg NPS (all services)</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border text-center">
            <p className="text-3xl font-bold" style={{ color: '#770142' }}>{responses.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Responses</p>
          </div>
        </div>
      </div>

      {/* Per-service breakdown */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#013f7c' }}>By Service</h3>
        <div className="space-y-4">
          {Object.entries(byService).map(([serviceName, svcResponses]) => {
            const ratingResponses = svcResponses.filter(r => r.overall_rating);
            const npsResponses = svcResponses.filter(r => r.nps_score != null);
            const avgRating = ratingResponses.length > 0
              ? (ratingResponses.reduce((s, r) => s + r.overall_rating, 0) / ratingResponses.length).toFixed(1)
              : null;
            const avgNPS = npsResponses.length > 0
              ? (npsResponses.reduce((s, r) => s + r.nps_score, 0) / npsResponses.length).toFixed(1)
              : null;

            const ratingPct = avgRating ? ((parseFloat(avgRating) / 5) * 100).toFixed(0) : 0;
            const npsPct = avgNPS ? ((parseFloat(avgNPS) / 10) * 100).toFixed(0) : 0;

            return (
              <div key={serviceName} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{serviceName}</p>
                    <p className="text-xs text-gray-400">{svcResponses.length} response{svcResponses.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right text-sm">
                    {avgRating && <p className="text-gray-600">⭐ {avgRating}/5</p>}
                    {avgNPS && <p className="text-gray-600">NPS: {avgNPS}/10</p>}
                  </div>
                </div>
                {avgRating && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Rating vs benchmark ({overallAvgRating}/5)</span>
                      <span>{ratingPct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${ratingPct}%`, backgroundColor: parseFloat(avgRating) >= parseFloat(overallAvgRating) ? '#264d44' : '#f59e0b' }}
                      />
                    </div>
                  </div>
                )}
                {avgNPS && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>NPS vs benchmark ({overallAvgNPS}/10)</span>
                      <span>{npsPct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${npsPct}%`, backgroundColor: parseFloat(avgNPS) >= parseFloat(overallAvgNPS) ? '#013f7c' : '#ef4444' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function ResponseCard({ response }) {
  const [expanded, setExpanded] = useState(false);
  const date = response.submitted_at ? new Date(response.submitted_at).toLocaleDateString() : '—';

  return (
    <div className="bg-white rounded-xl shadow-lg p-5">
      <div className="flex flex-col md:flex-row justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-800">{response.full_name || 'Anonymous'}</p>
          <p className="text-sm text-gray-500">{response.company_name || '—'} • {response.email_address}</p>
          <p className="text-xs text-gray-400 mt-1">{response.service_name} • {date}</p>
        </div>
        <div className="flex items-center gap-3">
          {response.overall_rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-semibold text-gray-700">{response.overall_rating.toFixed(1)}</span>
            </div>
          )}
          {response.nps_score != null && (
            <Badge style={{ backgroundColor: response.nps_score >= 9 ? '#264d44' : response.nps_score >= 7 ? '#f59e0b' : '#ef4444', color: 'white' }}>
              NPS: {response.nps_score}
            </Badge>
          )}
          {response.raffle_address && <Badge className="bg-amber-100 text-amber-700">Raffle ✓</Badge>}
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Less' : 'Details'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {(response.answers || []).filter(a => a.value).map((a, idx) => (
            <div key={idx} className="text-sm">
              <p className="font-medium text-gray-600">{a.question_text}</p>
              <p className="text-gray-800 mt-0.5">{a.value}</p>
            </div>
          ))}
          {response.raffle_address && (
            <div className="text-sm bg-amber-50 rounded-lg p-3">
              <p className="font-medium text-amber-700">Raffle Address</p>
              <p className="text-amber-900 mt-0.5">{response.raffle_address}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}