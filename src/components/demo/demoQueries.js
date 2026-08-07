import { base44 } from '@/api/base44Client';

export async function fetchDemoCounts() {
  const [clients, partners, referrals, proposals, invoices, events, feedback, cohorts, tasks, activities, mfsAssessments] = await Promise.all([
    base44.entities.Client.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.ReferralPartner.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.Referral.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.Proposal.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.Invoice.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.CalendarEvent.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.FeedbackResponse.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.CohortAssessment.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.ClientTask.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.ReferralActivity.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.MfsAssessment.filter({ is_demo: true }, '-created_date', 1000),
  ]);

  const mfsResponses = cohorts.filter(c => c.survey_type === 'mfs').length;
  const counts = {
    clients: clients.length,
    referralPartners: partners.length,
    referrals: referrals.length,
    proposals: proposals.length,
    invoices: invoices.length,
    calendarEventsDelivered: events.filter(e => e.completed).length,
    calendarEventsUpcoming: events.filter(e => !e.completed).length,
    feedbackResponses: feedback.length,
    cohortDay0: cohorts.filter(c => c.survey_type === 'challenge_day0').length,
    cohortDay14: cohorts.filter(c => c.survey_type === 'challenge_day14').length,
    cohortStart: cohorts.filter(c => c.survey_type === 'cohort_start').length,
    cohortEnd: cohorts.filter(c => c.survey_type === 'cohort_end').length,
    mfsAssessments: mfsAssessments.length,
    mfsResponses,
    clientTasks: tasks.length,
    referralActivities: activities.length,
  };
  counts.total =
    counts.clients + counts.referralPartners + counts.referrals + counts.proposals + counts.invoices +
    counts.calendarEventsDelivered + counts.calendarEventsUpcoming + counts.feedbackResponses +
    counts.cohortDay0 + counts.cohortDay14 + counts.cohortStart + counts.cohortEnd +
    counts.clientTasks + counts.referralActivities + counts.mfsAssessments + counts.mfsResponses;
  return counts;
}

const CLIENT_DESCRIPTIONS = {
  'Lakeside Manufacturing': 'Full year of delivered workshops, ROI dashboard populated, cohort assessments complete.',
  'Brightpath Credit Union': 'Mid-journey program — half delivered, next challenge starting soon.',
  'Meridian Health Group': 'Recently converted — first workshop delivered, remaining sessions scheduled.',
};

export async function fetchPortalLinks() {
  const [partners, clients] = await Promise.all([
    base44.entities.ReferralPartner.filter({ is_demo: true }, '-created_date', 10),
    base44.entities.Client.filter({ is_demo: true }, '-created_date', 10),
  ]);
  const origin = window.location.origin;
  const broker = partners[0];
  const brokerLink = broker ? {
    name: broker.name,
    company: broker.company || 'Broker Portal',
    url: `${origin}/ReferralPortal?id=${broker.unique_portal_id}`,
    description: 'Active broker partner with placed clients, commission ledger, and a pending referral in the pipeline.',
    type: 'broker',
  } : null;
  // Only clients that actually have a portal token get a card. Without this a
  // tokenless demo client renders a ?token=undefined link that looks live and
  // dead-ends on click — which is exactly how the MFS demo clients were
  // showing up alongside the three real portal clients.
  const clientLinks = clients
    .filter(c => !!c.portal_token)
    .map(c => ({
      name: c.name,
      company: c.company,
      url: `${origin}/ClientPortal?token=${c.portal_token}`,
      description: CLIENT_DESCRIPTIONS[c.company] || 'Demo client portal with program details and resources.',
      type: 'client',
    }));

  // MFS assessment links with intake details and response counts
  const mfsAssessments = await base44.entities.MfsAssessment.filter({ is_demo: true }, '-created_date', 10);
  const mfsCohortRecords = await base44.entities.CohortAssessment.filter({ survey_type: 'mfs', is_demo: true }, '-submitted_at', 500);
  const sidSetByClient = {};
  for (const r of mfsCohortRecords) {
    if (!r.client_id) continue;
    const sid = r.instrument_subscores?._sid;
    if (!sid) continue;
    if (!sidSetByClient[r.client_id]) sidSetByClient[r.client_id] = new Set();
    sidSetByClient[r.client_id].add(sid);
  }
  const mfsLinks = mfsAssessments.map(a => ({
    name: a.contact_name || 'HR Contact',
    company: a.company_name || 'MFS Company',
    employeeCount: a.employee_count || '',
    industry: a.industry || '',
    goals: a.goals || [],
    status: a.status || 'collecting',
    responseCount: sidSetByClient[a.client_id]?.size || 0,
    surveyUrl: `${origin}/MfsSurvey?t=${a.token}`,
    resultsUrl: `${origin}/MfsResults?t=${a.token}`,
  }));
  return { brokerLink, clientLinks, mfsLinks };
}