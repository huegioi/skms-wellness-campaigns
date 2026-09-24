import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { programStatuses, statusCounts, NON_PROGRAM_TYPES } from '../programStatus';
import { serviceForEvent, programNameForEvent } from '../timelineItems';
import { summarizeResults } from '../portalResults';

/**
 * Everything the referral partner portal needs about a partner's book of
 * business, per client and in total. Shares its react-query cache key with
 * BrokerFeedbackRollup, so the portfolio numbers and client cards come from a
 * single getRoiData call.
 */
export function usePartnerBook({ portalId, clientCompanies = [], proposals = [], services = [], events = [] }) {
  const clientIds = clientCompanies.map(c => c.id);
  const { data: roiData, isLoading } = useQuery({
    queryKey: ['broker-roi-rollup', portalId, clientIds.join(',')],
    queryFn: async () => {
      if (clientIds.length === 0 || !portalId) return { feedback_responses: [], cohort_assessments: [] };
      const res = await base44.functions.invoke('getRoiData', { portal_id: portalId, client_ids: clientIds });
      return res.data;
    },
    enabled: !!portalId && clientIds.length > 0,
    retry: 1,
  });

  const clients = useMemo(() => clientCompanies.map(c => {
    const cEvents = events.filter(e => e.client_id === c.id);
    const cProposals = proposals.filter(p => p.client_id === c.id);
    const programs = programStatuses(cProposals, services, cEvents);
    const now = Date.now();
    const next = cEvents
      .filter(e => !NON_PROGRAM_TYPES.has(e.event_type) && new Date(e.start_date).getTime() > now)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] || null;
    const nextService = next ? serviceForEvent(next, services) : null;
    const scoped = roiData ? {
      feedback_responses: (roiData.feedback_responses || []).filter(r => r.client_id === c.id),
      cohort_assessments: (roiData.cohort_assessments || []).filter(r => r.client_id === c.id),
      participation: roiData.participation ? roiData.participation.filter(p => p.client_id === c.id) : null,
    } : null;
    return {
      client: c,
      programs,
      counts: statusCounts(programs),
      nextSession: next ? { event: next, name: programNameForEvent(next, nextService), image: nextService?.images?.[0]?.url || null } : null,
      results: scoped ? summarizeResults(scoped, null) : null,
      participation: scoped?.participation || [],
    };
  }), [clientCompanies, events, proposals, services, roiData]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const byId = Object.fromEntries(clientCompanies.map(c => [c.id, c]));
    return events
      .filter(e => !NON_PROGRAM_TYPES.has(e.event_type) && !e.completed && new Date(e.start_date).getTime() > now)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .map(e => {
        const svc = serviceForEvent(e, services);
        const name = programNameForEvent(e, svc);
        const company = byId[e.client_id]?.company || '';
        return {
          event: e, name, company, image: svc?.images?.[0]?.url || null,
          cal: {
            id: `partner-${e.id}`,
            title: `${name}${company ? ` — ${company}` : ''} (SkillfulMeans)`,
            start: e.start_date, end: e.end_date, alarmMinutes: 60,
            description: `${company ? `${company}'s ` : ''}SkillfulMeans session: ${name}.`,
          },
        };
      });
  }, [events, services, clientCompanies]);

  const bookResults = useMemo(() => (roiData ? summarizeResults(roiData, null) : null), [roiData]);

  return { roiData, isLoading, clients, upcoming, bookResults };
}
