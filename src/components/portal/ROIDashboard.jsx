import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { TrendingUp, Users, Star, MessageSquare, Copy, Check, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function StatCard({ label, value, sub, color = '#013f7c' }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function npsCategory(score) {
  if (score >= 9) return { label: 'Promoter', color: '#22c55e' };
  if (score >= 7) return { label: 'Passive', color: '#f59e0b' };
  return { label: 'Detractor', color: '#ef4444' };
}

export default function ROIDashboard({ clientId, clientCompany, services = [], showReportButton = false, onGenerateReport }) {
  const [selectedServiceId, setSelectedServiceId] = useState('all');
  const [copiedUrl, setCopiedUrl] = useState(null);

  const { data: allResponses = [], isLoading } = useQuery({
    queryKey: ['roi-responses', clientId],
    queryFn: () => base44.entities.FeedbackResponse.filter({ client_id: clientId }, '-submitted_at', 200),
    enabled: !!clientId
  });

  // Filter responses by selected service
  const responses = selectedServiceId === 'all'
    ? allResponses
    : allResponses.filter(r => r.service_id === selectedServiceId);

  // Aggregate stats
  const withROI = responses.filter(r => r.pre_stress_impact || r.tool_equipped_confidence || r.pressure_management_ability);
  const withNPS = responses.filter(r => r.nps_score !== null && r.nps_score !== undefined);

  const avg = (arr, key) => {
    const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v));
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const avgStress = avg(responses, 'pre_stress_impact');
  const avgConfidence = avg(responses, 'tool_equipped_confidence');
  const avgPressure = avg(responses, 'pressure_management_ability');
  const avgNPS = avg(responses, 'nps_score');

  const promoters = withNPS.filter(r => r.nps_score >= 9).length;
  const detractors = withNPS.filter(r => r.nps_score <= 6).length;
  const npsCalc = withNPS.length
    ? Math.round(((promoters - detractors) / withNPS.length) * 100)
    : null;

  const radarData = [
    { metric: 'Stress Reduction', value: avgStress ? Math.round(avgStress * 20) : 0, max: 100 },
    { metric: 'Tool Confidence', value: avgConfidence ? Math.round(avgConfidence * 20) : 0, max: 100 },
    { metric: 'Pressure Mgmt', value: avgPressure ? Math.round(avgPressure * 20) : 0, max: 100 },
    { metric: 'Recommend', value: avgNPS != null ? Math.round(avgNPS * 10) : 0, max: 100 },
  ];

  // Per-service bar chart data
  const serviceStats = services
    .filter(s => allResponses.some(r => r.service_id === s.id))
    .map(s => {
      const sResponses = allResponses.filter(r => r.service_id === s.id);
      const sNPS = avg(sResponses, 'nps_score');
      return {
        name: s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name,
        fullName: s.name,
        nps: sNPS != null ? Math.round(sNPS * 10) / 10 : 0,
        count: sResponses.length,
        id: s.id,
      };
    });

  // Takeaways
  const takeaways = responses
    .filter(r => r.biggest_takeaway && r.biggest_takeaway.trim().length > 10)
    .slice(0, 5);

  const copyFeedbackUrl = (serviceId, serviceName) => {
    const url = `${window.location.origin}/AttendeeForm?service_id=${serviceId}&client_id=${clientId}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(serviceId);
    toast.success(`Feedback link for "${serviceName}" copied! Turn it into a QR code.`);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#013f7c] rounded-full animate-spin mr-3" />
        Loading ROI data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Wellness ROI Dashboard</h3>
          <p className="text-sm text-gray-500">{allResponses.length} total responses{clientCompany ? ` · ${clientCompany}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {showReportButton && onGenerateReport && (
            <Button onClick={onGenerateReport} className="bg-[#013f7c] text-white text-xs">
              Generate Client Report
            </Button>
          )}
          <select
            value={selectedServiceId}
            onChange={e => setSelectedServiceId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#013f7c]/20"
          >
            <option value="all">All Programs</option>
            {services.filter(s => allResponses.some(r => r.service_id === s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {allResponses.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No feedback collected yet.</p>
          <p className="text-sm mt-1">Share QR-code links from the sessions below to start capturing ROI data.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Responses" value={responses.length} sub="attendees surveyed" color="#013f7c" />
            <StatCard
              label="Net Promoter Score"
              value={npsCalc != null ? `${npsCalc > 0 ? '+' : ''}${npsCalc}` : '—'}
              sub={`Avg ${avgNPS != null ? avgNPS.toFixed(1) : '—'}/10`}
              color={npsCalc != null && npsCalc >= 50 ? '#22c55e' : npsCalc != null && npsCalc >= 0 ? '#f59e0b' : '#ef4444'}
            />
            <StatCard
              label="Stress Reduction"
              value={avgStress ? `${avgStress.toFixed(1)}/5` : '—'}
              sub="Presenteeism proxy"
              color="#264d44"
            />
            <StatCard
              label="Pressure Mgmt"
              value={avgPressure ? `${avgPressure.toFixed(1)}/5` : '—'}
              sub="Absenteeism proxy"
              color="#770142"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Radar */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Program Impact Overview</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Radar dataKey="value" stroke="#013f7c" fill="#013f7c" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-gray-400 mt-1">All metrics normalized to 0–100%</p>
            </div>

            {/* Per-service NPS */}
            {serviceStats.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-3">Avg NPS by Program</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={serviceStats} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip
                      formatter={(v, _, p) => [`${v.toFixed(1)}/10 (${p.payload.count} responses)`, 'Avg NPS']}
                    />
                    <Bar dataKey="nps" radius={4}>
                      {serviceStats.map((entry, i) => (
                        <Cell key={i} fill={entry.nps >= 8 ? '#22c55e' : entry.nps >= 6 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Takeaways */}
          {takeaways.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-[#013f7c]" />
                <p className="text-sm font-semibold text-gray-700">Top Takeaways</p>
              </div>
              <div className="space-y-2">
                {takeaways.map((r, i) => (
                  <blockquote key={i} className="text-sm text-gray-600 border-l-4 border-[#264d44]/30 pl-3 italic">
                    "{r.biggest_takeaway}"
                    {r.full_name && <span className="not-italic text-xs text-gray-400 ml-2">— {r.full_name}</span>}
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* QR / Feedback Link Generator */}
      {services.filter(s => s.is_active !== false).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-[#013f7c]" />
            <p className="text-sm font-semibold text-gray-700">Session Feedback Links</p>
            <span className="text-xs text-gray-400">— Copy & convert to QR code for end-of-session collection</span>
          </div>
          <div className="space-y-2">
            {services.slice(0, 8).map(s => {
              const count = allResponses.filter(r => r.service_id === s.id).length;
              return (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{count} response{count !== 1 ? 's' : ''} collected</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyFeedbackUrl(s.id, s.name)}
                    className="shrink-0 text-xs border-[#013f7c] text-[#013f7c]"
                  >
                    {copiedUrl === s.id
                      ? <><Check className="w-3 h-3 mr-1" /> Copied</>
                      : <><Copy className="w-3 h-3 mr-1" /> Copy Link</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}