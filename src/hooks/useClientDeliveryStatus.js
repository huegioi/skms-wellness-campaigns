import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays, parseISO } from 'date-fns';

function daysAgo(dateStr) {
  if (!dateStr) return null;
  try {
    const d = typeof dateStr === 'string' && dateStr.length <= 10 ? parseISO(dateStr) : new Date(dateStr);
    return differenceInDays(new Date(), d);
  } catch { return null; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  try { return differenceInDays(parseISO(dateStr), new Date()); }
  catch { return null; }
}

/**
 * Compute a delivery snapshot for a single client from bulk-fetched data.
 */
function computeSnapshot(client, data) {
  const { proposals, events, services, cohortAssessments, feedback } = data;

  const acceptedProposals = proposals.filter(p => p.client_id === client.id && p.status === 'accepted');
  const acceptedProposalIds = new Set(acceptedProposals.map(p => p.id));

  // Selected service IDs from accepted proposals (services only, not wellness boxes)
  const selectedServiceIds = new Set();
  for (const proposal of acceptedProposals) {
    const sel = proposal.selections || {};
    [
      ...(sel.workshops || []),
      ...(sel.challengePrograms || []),
      ...(sel.leadership || []),
      ...(sel.movementClasses || []),
    ].forEach(id => { if (id) selectedServiceIds.add(id); });
  }

  // Determine which selected services are challenges
  const challengeServiceIds = new Set();
  for (const s of services) {
    if (s.category === 'challenge' && selectedServiceIds.has(s.id)) {
      challengeServiceIds.add(s.id);
    }
  }
  for (const proposal of acceptedProposals) {
    (proposal.selections?.challengePrograms || []).forEach(id => challengeServiceIds.add(id));
  }

  const totalServices = selectedServiceIds.size;

  // Calendar events linked to this client (by client_id or accepted proposal_id)
  const clientEvents = events.filter(e =>
    e.client_id === client.id || (e.proposal_id && acceptedProposalIds.has(e.proposal_id))
  );

  // Delivered + scheduled services (matched by service_id)
  const deliveredServiceIds = new Set();
  const scheduledServiceIds = new Set();
  for (const e of clientEvents) {
    if (e.service_id && selectedServiceIds.has(e.service_id)) {
      scheduledServiceIds.add(e.service_id);
      if (e.completed) deliveredServiceIds.add(e.service_id);
    }
  }
  const unscheduledCount = totalServices - scheduledServiceIds.size;

  // Next upcoming event
  const now = new Date();
  const upcoming = clientEvents
    .filter(e => new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  const nextEvent = upcoming[0] || null;

  // Presenter status on next event
  let presenterStatus = 'none';
  if (nextEvent) {
    if (nextEvent.presenter_accepted === true) presenterStatus = 'accepted';
    else if (nextEvent.presenter_id) presenterStatus = 'assigned';
    else presenterStatus = 'unassigned';
  }

  // Assessment signal — challenges: day0/day14 from CohortAssessment
  let challengeAssessment = null;
  if (challengeServiceIds.size > 0) {
    let d0 = false, d14 = false;
    for (const a of cohortAssessments) {
      if (a.client_id !== client.id) continue;
      if (!challengeServiceIds.has(a.service_id)) continue;
      if (a.survey_type === 'challenge_day0') d0 = true;
      if (a.survey_type === 'challenge_day14') d14 = true;
    }
    challengeAssessment = { d0, d14 };
  }

  // Assessment signal — non-challenges: feedback response count
  let feedbackCount = 0;
  for (const f of feedback) {
    if (f.client_id === client.id) feedbackCount++;
  }

  // Renewal chip (within 90 days)
  let renewal = null;
  if (client.renewal_date) {
    const d = daysUntil(client.renewal_date);
    if (d !== null && d >= 0 && d <= 90) {
      renewal = { daysUntil: d, suggestMove: d < 60 };
    }
  }

  // Health dot
  const hasNextEvent = !!nextEvent;
  const presenterAccepted = nextEvent?.presenter_accepted === true;
  const allScheduled = totalServices === 0 || unscheduledCount === 0;
  const lastTouchDays = daysAgo(client.last_contacted_date);
  let health;
  if (!hasNextEvent && (lastTouchDays === null || lastTouchDays > 30)) {
    health = 'red';
  } else if (hasNextEvent && presenterAccepted && allScheduled) {
    health = 'green';
  } else {
    health = 'amber';
  }

  return {
    totalServices,
    deliveredCount: deliveredServiceIds.size,
    nextEvent,
    unscheduledCount,
    presenterStatus,
    challengeAssessment,
    feedbackCount,
    renewal,
    health,
    hasAcceptedProposals: acceptedProposals.length > 0,
  };
}

/**
 * Shared hook: computes delivery snapshots for a list of clients.
 * Used by ClientPipelineView (board) and ClientDetailView.
 * @param {Array} clients - client objects to compute snapshots for
 * @returns {Object} map of clientId -> snapshot
 */
export function useClientDeliveryStatus(clients) {
  const clientIds = useMemo(() => clients.map(c => c.id).filter(Boolean), [clients]);
  const enabled = clientIds.length > 0;

  const { data: proposals = [] } = useQuery({
    queryKey: ['delivery-proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date', 500),
    enabled,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['delivery-events'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 500),
    enabled,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['delivery-services'],
    queryFn: () => base44.entities.Service.list('sort_order', 200),
    enabled,
  });

  const { data: cohortAssessments = [] } = useQuery({
    queryKey: ['delivery-cohort'],
    queryFn: () => base44.entities.CohortAssessment.list('-submitted_at', 500),
    enabled,
  });

  const { data: feedback = [] } = useQuery({
    queryKey: ['delivery-feedback'],
    queryFn: () => base44.entities.FeedbackResponse.list('-submitted_at', 500),
    enabled,
  });

  return useMemo(() => {
    const map = {};
    for (const client of clients) {
      if (!client?.id) continue;
      map[client.id] = computeSnapshot(client, { proposals, events, services, cohortAssessments, feedback });
    }
    return map;
  }, [clients, proposals, events, services, cohortAssessments, feedback]);
}