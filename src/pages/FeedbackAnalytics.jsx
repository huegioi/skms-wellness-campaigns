import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, MessageSquare, Heart, BarChart2, Loader2 } from 'lucide-react';

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

function ConfidenceBar({ value, max = 10 }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 7 ? '#264d44' : value >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{value}/10</span>
    </div>
  );
}

export default function FeedbackAnalytics() {
  const [filterService, setFilterService] = useState('all');

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['feedback-responses-all'],
    queryFn: () => base44.entities.FeedbackResponse.list('-submitted_at', 500)
  });

  // Universal Pulse responses (have the new fields)
  const pulseResponses = responses.filter(r => r.behavior_intent || r.fit_confidence != null);

  const filtered = filterService === 'all'
    ? pulseResponses
    : pulseResponses.filter(r => r.service_id === filterService);

  const avgConfidence = filtered.length > 0
    ? (filtered.reduce((s, r) => s + (r.fit_confidence || 0), 0) / filtered.filter(r => r.fit_confidence != null).length).toFixed(1)
    : null;

  const advocacyCount = filtered.filter(r => r.advocacy_referral?.trim()).length;

  // Group by service
  const byService = {};
  for (const r of pulseResponses) {
    const key = r.service_name || r.service_id || 'Unknown';
    if (!byService[key]) byService[key] = [];
    byService[key].push(r);
  }

  // Group by client/company
  const byClient = {};
  for (const r of pulseResponses) {
    const key = r.company_name || r.client_id || 'Unknown';
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(r);
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Universal Pulse Dashboard</h1>
          <p className="text-gray-600 mt-1">Behavior intent · Fit confidence · Advocacy referrals</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Responses" value={pulseResponses.length} color="#013f7c" />
          <StatCard icon={TrendingUp} label="Avg Fit Confidence" value={avgConfidence ? `${avgConfidence}/10` : '—'} color="#264d44" />
          <StatCard icon={Heart} label="Advocacy Mentions" value={advocacyCount} color="#770142" />
          <StatCard icon={MessageSquare} label="Intent Statements" value={filtered.filter(r => r.behavior_intent?.trim()).length} color="#ff9878" />
        </div>

        {/* Filter */}
        <div className="mb-6 max-w-xs">
          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by program..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {services.filter(s => pulseResponses.some(r => r.service_id === s.id)).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="responses">
          <TabsList className="bg-white shadow-md mb-6">
            <TabsTrigger value="responses" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              All Responses ({filtered.length})
            </TabsTrigger>
            <TabsTrigger value="by_program" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              By Program
            </TabsTrigger>
            <TabsTrigger value="by_cohort" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              By Cohort
            </TabsTrigger>
            <TabsTrigger value="advocacy" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
              Advocacy ({advocacyCount})
            </TabsTrigger>
          </TabsList>

          {/* All Responses */}
          <TabsContent value="responses">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No pulse responses yet</h3>
                <p className="text-gray-500">Share the QR code at the end of a session to start collecting.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(r => (
                  <PulseResponseCard key={r.id} response={r} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* By Program */}
          <TabsContent value="by_program">
            <div className="space-y-4">
              {Object.entries(byService).map(([serviceName, svcR]) => {
                const avgConf = svcR.filter(r => r.fit_confidence != null).length > 0
                  ? (svcR.reduce((s, r) => s + (r.fit_confidence || 0), 0) / svcR.filter(r => r.fit_confidence != null).length)
                  : null;
                const advCount = svcR.filter(r => r.advocacy_referral?.trim()).length;
                const intents = svcR.filter(r => r.behavior_intent?.trim());
                return (
                  <div key={serviceName} className="bg-white rounded-xl shadow-lg p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{serviceName}</h3>
                        <p className="text-xs text-gray-400">{svcR.length} response{svcR.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right text-sm space-y-0.5">
                        {avgConf != null && <p className="text-[#013f7c] font-semibold">Confidence: {avgConf.toFixed(1)}/10</p>}
                        <p className="text-[#770142]">Referrals: {advCount}</p>
                      </div>
                    </div>
                    {avgConf != null && <ConfidenceBar value={parseFloat(avgConf.toFixed(1))} />}
                    {intents.length > 0 && (
                      <div className="mt-3 space-y-1 border-t pt-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Intent Statements</p>
                        {intents.slice(0, 3).map((r, i) => (
                          <blockquote key={i} className="text-sm text-gray-600 border-l-3 border-[#264d44]/30 pl-3 italic">
                            "{r.behavior_intent}"
                          </blockquote>
                        ))}
                        {intents.length > 3 && <p className="text-xs text-gray-400">+{intents.length - 3} more</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(byService).length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <BarChart2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No data yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* By Cohort (Client/Company) */}
          <TabsContent value="by_cohort">
            <div className="space-y-4">
              {Object.entries(byClient).map(([company, cohortR]) => {
                const avgConf = cohortR.filter(r => r.fit_confidence != null).length > 0
                  ? (cohortR.reduce((s, r) => s + (r.fit_confidence || 0), 0) / cohortR.filter(r => r.fit_confidence != null).length)
                  : null;
                const advCount = cohortR.filter(r => r.advocacy_referral?.trim()).length;
                return (
                  <div key={company} className="bg-white rounded-xl shadow-lg p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{company}</h3>
                        <p className="text-xs text-gray-400">{cohortR.length} response{cohortR.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right text-sm space-y-0.5">
                        {avgConf != null && <p className="text-[#013f7c] font-semibold">{avgConf.toFixed(1)}/10 confidence</p>}
                        <p className="text-[#770142]">{advCount} referral{advCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {avgConf != null && <ConfidenceBar value={parseFloat(avgConf.toFixed(1))} />}
                  </div>
                );
              })}
              {Object.keys(byClient).length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No cohort data yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Advocacy */}
          <TabsContent value="advocacy">
            <div className="space-y-3">
              {filtered.filter(r => r.advocacy_referral?.trim()).map(r => (
                <div key={r.id} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-[#770142]">"{r.advocacy_referral}"</p>
                    {r.fit_confidence != null && (
                      <Badge className="bg-[#013f7c]/10 text-[#013f7c]">Confidence: {r.fit_confidence}/10</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{r.service_name} · {r.company_name} · {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}</p>
                </div>
              ))}
              {filtered.filter(r => r.advocacy_referral?.trim()).length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No advocacy referrals yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PulseResponseCard({ response }) {
  const [expanded, setExpanded] = useState(false);
  const date = response.submitted_at ? new Date(response.submitted_at).toLocaleDateString() : '—';

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex flex-col sm:flex-row justify-between gap-2">
        <div className="flex-1 min-w-0">
          {response.behavior_intent && (
            <p className="text-sm text-gray-800 italic">"{response.behavior_intent}"</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{response.service_name} · {response.company_name} · {date}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {response.fit_confidence != null && (
            <Badge className="bg-[#013f7c]/10 text-[#013f7c]">{response.fit_confidence}/10</Badge>
          )}
          {response.advocacy_referral?.trim() && (
            <Badge className="bg-[#770142]/10 text-[#770142]">Referral</Badge>
          )}
          {response.advocacy_referral?.trim() && (
            <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Less' : 'See'}
            </Button>
          )}
        </div>
      </div>
      {expanded && response.advocacy_referral && (
        <div className="mt-3 border-t pt-3 text-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Referral</p>
          <p className="text-[#770142]">{response.advocacy_referral}</p>
        </div>
      )}
    </div>
  );
}