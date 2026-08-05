import React, { useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, ShieldAlert } from 'lucide-react';
import ReportWellbeingOutcomes from '@/components/feedback/ReportWellbeingOutcomes';

function avg(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function topImpacts(recs, n = 3) {
  const tally = {};
  for (const r of recs) {
    if (Array.isArray(r.expected_impact)) {
      for (const imp of r.expected_impact) tally[imp] = (tally[imp] || 0) + 1;
    }
  }
  return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function ClientReport() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id');
  const portalId = searchParams.get('portal_id');
  const token = searchParams.get('token');
  const printRef = useRef();

  // Always validate access — portal_id (broker), token (client portal), or admin auth
  const { data: accessResult, isLoading: checkingAccess } = useQuery({
    queryKey: ['report-access', portalId, token, clientId],
    queryFn: () => base44.functions.invoke('validateClientReportAccess', {
      client_id: clientId,
      ...(portalId ? { portal_id: portalId } : {}),
      ...(token ? { token } : {}),
    }).then(r => r.data),
    enabled: !!clientId,
    retry: false,
  });

  const accessGranted = accessResult?.allowed === true;
  const client = accessResult?.client || null;
  const responses = accessResult?.responses || [];
  const services = accessResult?.services || [];
  const checkins = accessResult?.checkins || [];
  const clientEvents = accessResult?.events || [];
  const cohortAssessments = accessResult?.cohort_assessments || [];

  const serviceMap = Object.fromEntries(services.map(s => [s.id, s]));

  // Attendance by event
  const attendanceByEvent = {};
  checkins.forEach(c => {
    attendanceByEvent[c.event_id] = (attendanceByEvent[c.event_id] || 0) + 1;
  });

  // People engaged: distinct emails across feedback + check-ins
  const feedbackEmails = new Set(responses.map(r => (r.attendee_email || r.email_address || '').toLowerCase().trim()).filter(Boolean));
  const checkinEmails = new Set(checkins.map(c => (c.email || '').toLowerCase().trim()).filter(Boolean));
  const peopleEngaged = new Set([...feedbackEmails, ...checkinEmails]).size;

  // Delivered sessions with attendance
  const sessionsWithAttendance = clientEvents
    .filter(e => e.completed)
    .map(e => ({
      ...e,
      attended: attendanceByEvent[e.id] || 0,
    }))
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  // eNPS — promoters/detractors/denominator from ONLY rows with a non-null nps_score.
  // (null <= 6 is true in JS, so the old formula counted non-resolvers as detractors.)
  const withNPS = useMemo(() => responses.filter(r => r.nps_score != null), [responses]);
  const promoters = useMemo(() => withNPS.filter(r => r.nps_score >= 9).length, [withNPS]);
  const detractors = useMemo(() => withNPS.filter(r => r.nps_score <= 6).length, [withNPS]);
  const npsScore = withNPS.length
    ? Math.round(((promoters - detractors) / withNPS.length) * 100)
    : null;

  // Distinct sessions covered by pulse responses
  const distinctSessions = useMemo(
    () => new Set(responses.map(r => r.event_id).filter(Boolean)).size,
    [responses]
  );

  // Avg confidence-to-apply (0-10)
  const avgConfidence = useMemo(() => {
    const vals = responses.map(r => r.fit_confidence).filter(v => v != null && !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [responses]);

  // Group by service
  const byService = useMemo(() => {
    const m = {};
    responses.forEach(r => {
      const key = r.service_id || r.service_name || 'Unknown';
      if (!m[key]) m[key] = [];
      m[key].push(r);
    });
    return m;
  }, [responses]);

  // Anonymous behavior-intent quotes (no attendee names in reports)
  const quotes = useMemo(
    () => responses.filter(r => r.behavior_intent?.trim().length > 10).slice(0, 6),
    [responses]
  );

  const handlePrint = () => window.print();

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        No client_id provided.
      </div>
    );
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-4 border-gray-200 border-t-[#013f7c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500 text-sm">You do not have permission to view this client report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print controls - hidden in print */}
      <div className="print:hidden bg-white border-b px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => window.history.back()} className="gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={handlePrint} className="bg-[#013f7c] text-white gap-2">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </Button>
      </div>

      <div ref={printRef} className="max-w-4xl mx-auto px-6 py-8 space-y-8 print:p-6 print:space-y-6">
        {/* Report header */}
        <div className="flex items-center justify-between border-b pb-6">
          <div>
            <img
              src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png"
              alt="SkillfulMeans"
              className="h-8 mb-3 invert"
              style={{ filter: 'invert(20%) sepia(90%) saturate(1000%) hue-rotate(195deg)' }}
            />
            <h1 className="text-2xl font-bold text-gray-900">
              {client?.company || client?.name || 'Client'} — Wellness ROI Report
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}{responses.length} responses{peopleEngaged > 0 ? ` · ${peopleEngaged} people engaged` : ''}
            </p>
          </div>
        </div>

        {responses.length === 0 && sessionsWithAttendance.length === 0 && cohortAssessments.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No feedback or attendance data collected yet for this client.</div>
        ) : (
          <>
            {/* KPI Summary */}
            <div>
              <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide mb-3">Program Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Respondents', value: responses.length, color: '#013f7c' },
                  {
                    label: 'Distinct Sessions',
                    value: distinctSessions || '—',
                    color: '#264d44'
                  },
                  {
                    label: 'Avg Confidence to Apply',
                    value: avgConfidence != null ? `${avgConfidence.toFixed(1)}/10` : '—',
                    color: '#770142'
                  },
                  {
                    label: 'Employee Net Promoter Score (eNPS)',
                    value: npsScore != null ? `${npsScore > 0 ? '+' : ''}${npsScore}` : '—',
                    color: npsScore >= 50 ? '#22c55e' : npsScore >= 0 ? '#f59e0b' : '#ef4444'
                  },
                ].map((s, i) => (
                  <div key={i} className="border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-program breakdown */}
            <div>
              <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide mb-3">Program Breakdown</h2>
              <div className="space-y-4">
                {Object.entries(byService).map(([key, recs]) => {
                  const svc = serviceMap[key];
                  const name = svc?.name || recs[0]?.service_name || key;
                  const sConf = avg(recs, 'fit_confidence');
                  const sNPS = avg(recs, 'nps_score');
                  const impacts = topImpacts(recs, 3);
                  const progSessions = new Set(recs.map(r => r.event_id).filter(Boolean)).size;
                  return (
                    <div key={key} className="border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold text-gray-800">{name}</p>
                          <p className="text-xs text-gray-400">{recs.length} respondent{recs.length !== 1 ? 's' : ''}{progSessions > 0 ? ` · ${progSessions} session${progSessions !== 1 ? 's' : ''}` : ''}</p>
                        </div>
                        <div className="flex gap-4 text-right">
                          {sConf != null && (
                            <div>
                              <p className="text-xs text-gray-400">Avg Confidence</p>
                              <p className="font-bold text-lg text-[#770142]">{sConf.toFixed(1)}/10</p>
                            </div>
                          )}
                          {sNPS != null && (
                            <div>
                              <p className="text-xs text-gray-400">Avg eNPS</p>
                              <p className="font-bold text-lg text-[#013f7c]">{sNPS.toFixed(1)}/10</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {impacts.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">Top Expected Impact Areas</p>
                          <div className="flex flex-wrap gap-2">
                            {impacts.map(([label, count]) => (
                              <span key={label} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-700">
                                {label} · {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wellbeing outcomes (cohort assessments) */}
            <ReportWellbeingOutcomes cohortAssessments={cohortAssessments} />

            {/* Session Attendance */}
            {sessionsWithAttendance.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide mb-3">Session Attendance</h2>
                <div className="space-y-2">
                  {sessionsWithAttendance.map(s => (
                    <div key={s.id} className="flex items-center justify-between border rounded-lg px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.title}</p>
                        <p className="text-xs text-gray-400">{new Date(s.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <p className="text-sm font-bold text-[#013f7c]">{s.attended} attended</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Behavior-intent quotes (anonymous) */}
            {quotes.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-700 uppercase tracking-wide mb-3">What Participants Will Do Differently</h2>
                <div className="space-y-3">
                  {quotes.map((r, i) => (
                    <blockquote key={i} className="border-l-4 border-[#264d44] pl-4 py-1">
                      <p className="text-sm text-gray-700 italic">"{r.behavior_intent}"</p>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-4 text-center text-xs text-gray-400">
              SkillfulMeans · Confidential Client Report · {new Date().getFullYear()}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}