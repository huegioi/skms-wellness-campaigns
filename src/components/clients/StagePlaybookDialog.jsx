import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

const PLAYBOOKS = {
  // ── Sales Pipeline ──────────────────────────────────────────
  discovery_call_scheduled: {
    label: 'Discovery Call Scheduled',
    description: 'Prepare thoroughly so the call makes a strong first impression.',
    steps: [
      'Confirm call time and attendees 1 day before',
      'Research the company and their current wellness programs',
      'Prepare relevant case studies for their industry',
      'Review if they were referred by a broker — note who',
      'Have service catalog and pricing ready',
    ],
  },
  discovery_call_complete: {
    label: 'Discovery Call Complete',
    description: 'Capture insights and move quickly while the conversation is fresh.',
    steps: [
      'Send recap email within 24 hours summarizing what was discussed',
      'Note their pain points, budget, employee count, and timeline',
      'Identify which services match their needs',
      'Update the client record with call notes',
      'If strong fit — begin building a proposal immediately',
    ],
  },
  proposal_sent: {
    label: 'Proposal Sent',
    description: 'Stay top of mind without being pushy — follow up with purpose.',
    steps: [
      'Follow up Day 3 with a quick check-in email',
      'Follow up Day 7 with a call if no response',
      'Follow up Day 14 with a final email offering to answer questions',
      'Track if proposal link was viewed',
      'If broker referred — update them on the proposal status',
    ],
  },
  proposal_viewed: {
    label: 'Proposal Viewed',
    description: 'Strike while the iron is hot — they\'re actively thinking about it.',
    steps: [
      'Call within 24 hours of viewing notification',
      'Ask if they have questions or need modifications',
      'Be ready to adjust pricing or scope',
      'If no response after call attempt — send a short email',
    ],
  },
  negotiation: {
    label: 'Negotiation',
    description: 'Move quickly, be flexible, and close the loop with a clear decision deadline.',
    steps: [
      'Respond to questions or objections same day',
      'Prepare modified proposals within 24 hours if needed',
      'Loop in their broker if they have one — brokers can help close',
      'Identify the decision maker if you\'re not already talking to them',
      'Set a clear timeline: "When do you need to decide by?"',
    ],
  },
  verbal_yes: {
    label: 'Verbal Yes',
    description: 'Secure the commitment and kickstart the relationship immediately.',
    steps: [
      'Send invoice within 24 hours',
      'Send a formal confirmation email with next steps',
      'Notify the referring broker with a thank you',
      'Begin preparing onboarding tasks',
      'Celebrate internally — update Maya\'s stats',
    ],
  },

  // ── Client Lifecycle ─────────────────────────────────────────
  new_client_setup: {
    label: 'New Client Setup',
    description: 'Get the client fully onboarded, programs scheduled, and the relationship off to a strong start.',
    steps: [
      'Schedule kickoff call with client champion',
      'Confirm program selections and dates',
      'Create client portal and upload resources',
      'Send welcome email with program overview',
      'Introduce presenter/facilitator if applicable',
      'Set up invoicing in QuickBooks',
      'Confirm employee count and logistics (virtual vs in-person)',
    ],
  },
  program_delivery: {
    label: 'Program Delivery',
    description: 'Execute programs with excellence and keep the client champion engaged throughout delivery.',
    steps: [
      'Confirm session logistics 1 week before each program',
      'Send pre-program survey to participants',
      'Brief presenter on company culture and goals',
      'Deliver program and track attendance',
      'Send follow-up materials within 24 hours',
      'Check in with client champion after each session',
      'Document any feedback or issues in real time',
    ],
  },
  followup_feedback: {
    label: 'Follow-up & Feedback',
    description: 'Capture outcomes, demonstrate ROI, and close the program loop before moving into nurture.',
    steps: [
      'Send post-program survey within 48 hours',
      'Collect and analyze survey results',
      'Build ROI report with engagement metrics',
      'Schedule debrief call with client champion',
      'Send closing email with ROI summary',
      'Ask for testimonial if results were strong',
      'Ask for referral if relationship is warm',
    ],
  },
  nurture: {
    label: 'Nurture',
    description: 'Stay top of mind between programs by consistently delivering value and deepening the relationship.',
    steps: [
      'Monthly value-add email (article, tip, resource)',
      'Quarterly check-in call',
      'Share relevant case studies or success stories',
      'Invite to webinars or events',
      'Monitor for May (Mental Health Month) opportunity',
      'Monitor for October/November (January renewal prep)',
      'Track any organizational changes (new HR lead, merger, etc.)',
    ],
  },
  renewal_outreach: {
    label: 'Renewal Outreach',
    description: 'Proactively secure the next year of programming before the plan year ends.',
    steps: [
      "Review current year's programs and outcomes",
      'Prepare renewal proposal with recommendations',
      'Schedule renewal meeting 60–90 days before plan year start',
      "Present ROI data and next year's program options",
      'Send formal proposal',
      'Follow up weekly until decision',
      'If renewed — move back to New Client Setup for new programs',
    ],
  },
  re_engage: {
    label: 'Re-engage',
    description: 'Win back a client who has gone quiet with a warm, personal approach before marking them churned.',
    steps: [
      'Send personal check-in email (not salesy)',
      'Call client champion directly',
      'Share something relevant to their industry or last conversation',
      'Offer a free resource or mini-session as a re-entry point',
      'If no response after 3 touches over 2 weeks — schedule follow-up for 30 days',
      'If still no response — move to Churned',
    ],
  },
  churned: {
    label: 'Churned',
    description: 'Close the relationship gracefully and set the stage for a future re-engagement.',
    steps: [
      'Document reason for churn if known',
      'Send a graceful closing email',
      'Set 6-month reminder to re-engage',
      'Track if their broker or HR contact changes',
      'Keep them on your newsletter list',
      'When re-engaging — lead with new offerings or case studies, not "we miss you"',
    ],
  },
};

export default function StagePlaybookDialog({ stageKey, open, onClose }) {
  const playbook = PLAYBOOKS[stageKey];
  if (!playbook) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#264d44]">{playbook.label}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">{playbook.description}</p>
        </DialogHeader>
        <ul className="mt-2 space-y-3">
          {playbook.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#264d44] mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">{step}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}