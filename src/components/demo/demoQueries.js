import { base44 } from '@/api/base44Client';

export async function fetchDemoCounts() {
  const [clients, partners, referrals, proposals, events, feedback, cohorts, tasks, activities, mfsAssessments] = await Promise.all([
    base44.entities.Client.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.ReferralPartner.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.Referral.filter({ is_demo: true }, '-created_date', 1000),
    base44.entities.Proposal.filter({ is_demo: true }, '-created_date', 1000),
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
    counts.clients + counts.referralPartners + counts.referrals + counts.proposals +
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
  const clientLinks = clients.map(c => ({
    name: c.name,
    company: c.company,
    url: `${origin}/ClientPortal?token=${c.portal_token}`,
    description: CLIENT_DESCRIPTIONS[c.company] || 'Demo client portal with program details and resources.',
    type: 'client',
  }));

  // MFS assessment links
  const mfsAssessments = await base44.entities.MfsAssessment.filter({ is_demo: true }, '-created_date', 10);
  const mfsLinks = mfsAssessments.map(a => ({
    name: a.contact_name || 'HR Contact',
    company: a.company_name || 'MFS Company',
    surveyUrl: `${origin}/MfsSurvey?t=${a.token}`,
    resultsUrl: `${origin}/MfsResults?t=${a.token}`,
    description: 'Mental Fitness Score assessment with demo responses — fully populated dashboard.',
  }));
  return { brokerLink, clientLinks, mfsLinks };
}