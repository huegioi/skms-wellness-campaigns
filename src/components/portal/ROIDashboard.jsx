import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Users, MessageSquare, Copy, Check, QrCode } from 'lucide-react';
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

export default function ROIDashboard({ clientId, clientCompany, services = [], showReportButton = false, onGenerateReport }) {
  const [selectedServiceId, setSelectedServiceId] = useState('all');
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [copiedWho5, setCopiedWho5] = useState(null); // `${serviceId}-day0` or `${serviceId}-day14`

  const { data: allResponses = [], isLoading } = useQuery({
    queryKey: ['roi-responses', clientId],
    queryFn: () => base44.entities.FeedbackResponse.filter({ client_id: clientId }, '-submitted_at', 200),
    enabled: !!clientId
  });

  // Universal Pulse responses only
  const pulseResponses = allResponses.filter(r => r.behavior_intent || r.fit_confidence != null);

  const responses = selectedServiceId === 'all'
    ? pulseResponses
    : pulseResponses.filter(r => r.service_id === selectedServiceId);

  // Metrics
  const withConfidence = responses.filter(r => r.fit_confidence != null);
  const avgConfidence = withConfidence.length
    ? (withConfidence.reduce((s, r) => s + r.fit_confidence, 0) / withConfidence.length)
    : null;

  const voiceQuotes = responses.filter(r => r.behavior_intent?.trim().length > 10).slice(0, 5);

  // Aggregate expected_impact across all responses
  const impactTally = {};
  for (const r of responses) {
    if (Array.isArray(r.expected_impact)) {
      for (const impact of r.expected_impact) {
        impactTally[impact] = (impactTally[impact] || 0) + 1;
      }
    }
  }
  const impactEntries = Object.entries(impactTally).sort((a, b) => b[1] - a[1]);
  const maxImpact = impactEntries[0]?.[1] || 1;

  // Per-service breakdown
  const serviceStats = services
    .filter(s => pulseResponses.some(r => r.service_id === s.id))
    .map(s => {
      const sR = pulseResponses.filter(r => r.service_id === s.id);
      const sConf = sR.filter(r => r.fit_confidence != null);
      const avgConf = sConf.length ? (sConf.reduce((a, r) => a + r.fit_confidence, 0) / sConf.length) : null;
      return { id: s.id, name: s.name, count: sR.length, avgConf };
    });

  const copyFeedbackUrl = (serviceId, serviceName) => {
    const url = `${window.location.origin}/AttendeeForm?service_id=${serviceId}&client_id=${clientId}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(serviceId);
    toast.success(`Feedback link for "${serviceName}" copied!`);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const copyWho5Url = (serviceId, serviceName, timing) => {
    const url = `${window.location.origin}/CohortAssessment?service_id=${serviceId}&client_id=${clientId}&timing=${timing}`;
    navigator.clipboard.writeText(url);
    const key = `${serviceId}-${timing}`;
    setCopiedWho5(key);
    toast.success(`WHO-5 ${timing === 'day0' ? 'Day 0' : 'Day 14'} link for "${serviceName}" copied!`);
    setTimeout(() => setCopiedWho5(null), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#013f7c] rounded-full animate-spin mr-3" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Wellness Impact Dashboard</h3>
          <p className="text-sm text-gray-500">{pulseResponses.length} pulse responses{clientCompany ? ` · ${clientCompany}` : ''}</p>
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
            {services.filter(s => pulseResponses.some(r => r.service_id === s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {pulseResponses.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-400 shadow-sm">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No pulse responses yet.</p>
          <p className="text-sm mt-1">Share QR-code links from the sessions below to start collecting data.</p>
        </div>
      ) : (
        <>
          {/* KPI cards — Reach / Advocacy / Voices / Confidence */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Reach"
              value={responses.length}
              sub="voices captured"
              color="#013f7c"
            />
            <StatCard
              label="Impact Areas"
              value={impactEntries.length > 0 ? impactEntries[0][0].split(' ').slice(0,2).join(' ') + '…' : '—'}
              sub="top selected impact"
              color="#770142"
            />
            <StatCard
              label="Fit Confidence"
              value={avgConfidence != null ? `${avgConfidence.toFixed(1)}/10` : '—'}
              sub="avg confidence score"
              color="#264d44"
            />
            <StatCard
              label="Voices"
              value={responses.filter(r => r.behavior_intent?.trim()).length}
              sub="intent statements"
              color="#ff9878"
            />
          </div>

          {/* Confidence bar if filtered */}
          {avgConfidence != null && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Fit Confidence Distribution</p>
              <ConfidenceBar value={parseFloat(avgConfidence.toFixed(1))} />
            </div>
          )}

          {/* Per-service breakdown */}
          {serviceStats.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">By Program</p>
              <div className="space-y-3">
                {serviceStats.map(s => (
                  <div key={s.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.count} response{s.count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right text-xs space-y-0.5">
                        {s.avgConf != null && <p className="text-[#264d44] font-semibold">{s.avgConf.toFixed(1)}/10 confidence</p>}
                        <p className="text-gray-400">{s.count} response{s.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {s.avgConf != null && <ConfidenceBar value={parseFloat(s.avgConf.toFixed(1))} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected Impact Chart */}
          {impactEntries.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Expected Impact Areas</p>
              <div className="space-y-2">
                {impactEntries.map(([label, count]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#264d44]"
                        style={{ width: `${Math.round((count / maxImpact) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voices — curated intent quotes */}
          {voiceQuotes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-[#013f7c]" />
                <p className="text-sm font-semibold text-gray-700">Voices — What They'll Do Differently</p>
              </div>
              <div className="space-y-2">
                {voiceQuotes.map((r, i) => (
                  <blockquote key={i} className="text-sm text-gray-600 border-l-4 border-[#264d44]/30 pl-3 italic">
                    "{r.behavior_intent}"
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
            <p className="text-sm font-semibold text-gray-700">Session Pulse Links</p>
            <span className="text-xs text-gray-400">— Copy link to generate QR code</span>
          </div>
          <div className="space-y-2">
            {services.slice(0, 8).map(s => {
              const count = pulseResponses.filter(r => r.service_id === s.id).length;
              return (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">{count} response{count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => copyFeedbackUrl(s.id, s.name)}
                     className="text-xs border-[#013f7c] text-[#013f7c]"
                   >
                     {copiedUrl === s.id
                       ? <><Check className="w-3 h-3 mr-1" /> Copied</>
                       : <><Copy className="w-3 h-3 mr-1" /> Copy Link</>}
                   </Button>
                   {s.category === 'challenge' && (<>
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => copyWho5Url(s.id, s.name, 'day0')}
                       className="text-xs border-[#264d44] text-[#264d44]"
                     >
                       {copiedWho5 === `${s.id}-day0`
                         ? <><Check className="w-3 h-3 mr-1" /> Copied</>
                         : <><Copy className="w-3 h-3 mr-1" /> WHO-5 Day 0</>}
                     </Button>
                     <Button
                       size="sm"
                       variant="outline"
                       onClick={() => copyWho5Url(s.id, s.name, 'day14')}
                       className="text-xs border-[#ff9878] text-[#c0604a]"
                     >
                       {copiedWho5 === `${s.id}-day14`
                         ? <><Check className="w-3 h-3 mr-1" /> Copied</>
                         : <><Copy className="w-3 h-3 mr-1" /> WHO-5 Day 14</>}
                     </Button>
                   </>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}