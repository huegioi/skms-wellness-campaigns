import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, MessageSquare, Heart, BarChart2, Loader2 } from 'lucide-react';
import FeedbackFilterBar from '@/components/feedback/FeedbackFilterBar';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function avgConf(arr) {
  const with_conf = arr.filter(r => r.fit_confidence != null);
  if (!with_conf.length) return null;
  return with_conf.reduce((s, r) => s + r.fit_confidence, 0) / with_conf.length;
}

function GroupCard({ title, subtitle, responses }) {
  const avg = avgConf(responses);
  const impactCount = responses.filter(r => Array.isArray(r.expected_impact) && r.expected_impact.length > 0).length;
  const intents = responses.filter(r => r.behavior_intent?.trim());
  return (
    <div className="bg-white rounded-xl shadow-lg p-5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <div className="text-right text-sm space-y-0.5">
          {avg != null && <p className="text-[#013f7c] font-semibold">Confidence: {avg.toFixed(1)}/10</p>}
          <p className="text-[#770142]">Impact selections: {impactCount}</p>
        </div>
      </div>
      {avg != null && <ConfidenceBar value={parseFloat(avg.toFixed(1))} />}
      {intents.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Intent Statements</p>
          {intents.slice(0, 3).map((r, i) => (
            <blockquote key={i} className="text-sm text-gray-600 border-l-4 border-[#264d44]/30 pl-3 italic">
              "{r.behavior_intent}"
            </blockquote>
          ))}
          {intents.length > 3 && <p className="text-xs text-gray-400">+{intents.length - 3} more</p>}
        </div>
      )}
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
          <p className="text-xs text-gray-400 mt-1">
            {response.service_name}
            {response.company_name ? ` · ${response.company_name}` : ''}
            {response.presenter ? ` · ${response.presenter}` : ''}
            {' · '}{date}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {response.fit_confidence != null && (
            <Badge className="bg-[#013f7c]/10 text-[#013f7c]">{response.fit_confidence}/10</Badge>
          )}
          {response.delivery_format && (
            <Badge variant="outline" className="capitalize">{response.delivery_format.replace('_', '-')}</Badge>
          )}
          {Array.isArray(response.expected_impact) && response.expected_impact.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Less' : `Impact (${response.expected_impact.length})`}
            </Button>
          )}
        </div>
      </div>
      {expanded && Array.isArray(response.expected_impact) && response.expected_impact.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Expected Impact</p>
          <div className="flex flex-wrap gap-1.5">
            {response.expected_impact.map(imp => (
              <Badge key={imp} className="bg-[#264d44]/10 text-[#264d44] text-xs">{imp}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  company: 'all',
  category: 'all',
  speaker: 'all',
  format: 'all',
  cohortYear: 'all',
  startDate: '',
  endDate: '',
};

export default function FeedbackAnalytics() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['feedback-responses-all'],
    queryFn: () => base44.entities.FeedbackResponse.list('-submitted_at', 1000),
  });

  // Fetch calendar events to enrich responses with presenter + delivery_format
  // (for older responses that predate the denormalized fields)
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events-all'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 500),
  });

  // Build a lookup: service_id → { presenter, delivery_format } from most recent event
  const eventLookup = useMemo(() => {
    const map = {};
    for (const ev of calendarEvents) {
      if (!ev.service_id) continue;
      if (!map[ev.service_id]) {
        map[ev.service_id] = { presenter: ev.presenter, delivery_format: ev.delivery_format };
      }
    }
    return map;
  }, [calendarEvents]);

  // Enrich responses with event data for missing fields
  const enriched = useMemo(() => responses.map(r => ({
    ...r,
    presenter: r.presenter || eventLookup[r.service_id]?.presenter || '',
    delivery_format: r.delivery_format || eventLookup[r.service_id]?.delivery_format || '',
  })), [responses, eventLookup]);

  // Universal Pulse responses (have at least one Phase 1 field)
  const pulseResponses = useMemo(
    () => enriched.filter(r => r.behavior_intent || r.fit_confidence != null),
    [enriched]
  );

  // ── Filter options (derived from actual data) ─────────────────────────────
  const companies = useMemo(() =>
    [...new Set(pulseResponses.map(r => r.company_name).filter(Boolean))].sort(),
    [pulseResponses]
  );

  const speakers = useMemo(() =>
    [...new Set(pulseResponses.map(r => r.presenter).filter(Boolean))].sort(),
    [pulseResponses]
  );

  // ── Apply filters ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return pulseResponses.filter(r => {
      if (filters.company !== 'all' && r.company_name !== filters.company) return false;
      if (filters.category !== 'all' && r.service_category !== filters.category) return false;
      if (filters.speaker !== 'all' && r.presenter !== filters.speaker) return false;
      if (filters.format !== 'all' && r.delivery_format !== filters.format) return false;
      if (filters.cohortYear !== 'all') {
        const year = r.submitted_at ? new Date(r.submitted_at).getFullYear() : null;
        if (String(year) !== filters.cohortYear) return false;
      }
      if (filters.startDate) {
        if (!r.submitted_at || r.submitted_at < filters.startDate) return false;
      }
      if (filters.endDate) {
        // endDate is inclusive through end of day
        if (!r.submitted_at || r.submitted_at.slice(0, 10) > filters.endDate) return false;
      }
      return true;
    });
  }, [pulseResponses, filters]);

  // ── Aggregations ──────────────────────────────────────────────────────────
  const avg = avgConf(filtered);
  const intentCount = filtered.filter(r => r.behavior_intent?.trim()).length;

  // Aggregate expected_impact (array field) across all filtered responses
  const impactTally = {};
  for (const r of filtered) {
    if (Array.isArray(r.expected_impact)) {
      for (const impact of r.expected_impact) {
        impactTally[impact] = (impactTally[impact] || 0) + 1;
      }
    }
  }
  const impactEntries = Object.entries(impactTally).sort((a, b) => b[1] - a[1]);
  const maxImpact = impactEntries[0]?.[1] || 1;

  // By Program (service_name)
  const byService = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      const key = r.service_name || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filtered]);

  // By Cohort: group by company + year
  const byCohort = useMemo(() => {
    const map = {};
    for (const r of filtered) {
      const company = r.company_name || 'Unknown';
      const year = r.submitted_at ? new Date(r.submitted_at).getFullYear() : 'Unknown';
      const key = `${company} — ${year}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filtered]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        <div className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Universal Pulse Dashboard</h1>
          <p className="text-gray-600 mt-1">Behavior intent · Fit confidence · Advocacy referrals</p>
        </div>

        {/* Unified Filter Bar */}
        <FeedbackFilterBar
          filters={filters}
          onChange={setFilters}
          companies={companies}
          speakers={speakers}
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Responses" value={filtered.length} color="#013f7c" />
          <StatCard icon={TrendingUp} label="Avg Fit Confidence" value={avg ? `${avg.toFixed(1)}/10` : '—'} color="#264d44" />
          <StatCard icon={Heart} label="Top Impact Area" value={impactEntries[0]?.[0]?.split(' ').slice(0,2).join(' ') + '…' || '—'} color="#770142" />
          <StatCard icon={MessageSquare} label="Intent Statements" value={intentCount} color="#ff9878" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <Tabs defaultValue="responses">
            <TabsList className="bg-white shadow-md mb-6 flex-wrap h-auto">
              <TabsTrigger value="responses" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
                All Responses ({filtered.length})
              </TabsTrigger>
              <TabsTrigger value="by_program" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
                By Program ({Object.keys(byService).length})
              </TabsTrigger>
              <TabsTrigger value="by_cohort" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
                By Cohort ({Object.keys(byCohort).length})
              </TabsTrigger>
              <TabsTrigger value="impact" className="data-[state=active]:bg-[#264d44] data-[state=active]:text-white">
                Impact Areas ({impactEntries.length})
              </TabsTrigger>
            </TabsList>

            {/* All Responses */}
            <TabsContent value="responses">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No responses match these filters</h3>
                  <p className="text-gray-500">Try broadening your filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(r => <PulseResponseCard key={r.id} response={r} />)}
                </div>
              )}
            </TabsContent>

            {/* By Program */}
            <TabsContent value="by_program">
              {Object.keys(byService).length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <BarChart2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No data for current filters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(byService)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([name, rows]) => (
                      <GroupCard
                        key={name}
                        title={name}
                        subtitle={`${rows.length} response${rows.length !== 1 ? 's' : ''}`}
                        responses={rows}
                      />
                    ))}
                </div>
              )}
            </TabsContent>

            {/* By Cohort */}
            <TabsContent value="by_cohort">
              {Object.keys(byCohort).length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No cohort data for current filters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(byCohort)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([cohortKey, rows]) => (
                      <GroupCard
                        key={cohortKey}
                        title={cohortKey}
                        subtitle={`${rows.length} response${rows.length !== 1 ? 's' : ''}`}
                        responses={rows}
                      />
                    ))}
                </div>
              )}
            </TabsContent>

            {/* Impact Areas */}
            <TabsContent value="impact">
              {impactEntries.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                  <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No impact selections match current filters</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                  <p className="text-sm text-gray-500">Total selections: {Object.values(impactTally).reduce((a, b) => a + b, 0)}</p>
                  {impactEntries.map(([label, count]) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm text-gray-700 mb-1">
                        <span>{label}</span>
                        <span className="font-bold text-[#264d44]">{count}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#264d44] transition-all"
                          style={{ width: `${Math.round((count / maxImpact) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}