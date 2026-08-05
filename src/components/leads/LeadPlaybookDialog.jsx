import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

/**
 * Playbook coaching content organized by the new Lead.status stages.
 * No data writes — purely informational checklist guidance.
 */
const LEAD_PLAYBOOKS = {
  cold: {
    label: 'New',
    description: 'Start the outreach sequence — connect before you pitch.',
    steps: [
      'Add to CRM with today\'s date and mark follow-up for Day 2.',
      'Send a personalized LinkedIn connection request mentioning a mutual interest or shared connection.',
      'Do not pitch — just connect and mention you\'d love to share what you do.',
      'If from an event: send a personalized follow-up email within 48 hours referencing something specific you discussed.',
      'Share a relevant resource — case study, one-pager, or ROI data.',
      'Connect on LinkedIn if not already connected.',
    ],
  },
  contacted: {
    label: 'Contacted',
    description: 'You\'ve made first contact. Keep the momentum with a multi-channel cadence.',
    steps: [
      'Send a brief intro email — who you are, what SkillfulMeans does, why you\'re reaching out (under 5 sentences).',
      'Call their direct line; if voicemail: leave a 20-second message — name, company, what you do.',
      'Send a short text following up on your call attempt.',
      'Second call at a different time of day than the first.',
      'LinkedIn follow-up message — soft, conversational, no pitch.',
      'Second email with a different angle — lead with a client success story or ROI data.',
      'Third email — make it about them, not you; ask about their book of business.',
    ],
  },
  in_conversation: {
    label: 'In Conversation',
    description: 'They\'re responding. Move toward a meeting while interest is warm.',
    steps: [
      'Propose a 15-minute discovery call with a clear, low-friction ask.',
      'Share a one-pager PDF or link to the SkillfulMeans overview.',
      'Ask about their renewal calendar — when are clients up for renewal?',
      'If no response after 5 days: send a "breakup" email communicating you won\'t keep following up.',
      'Final touch — brief, low-pressure, future-focused; offer a simple resource.',
      'Include a compelling stat or case study relevant to their market.',
    ],
  },
  meeting_scheduled: {
    label: 'Meeting Scheduled',
    description: 'Prepare thoroughly so the meeting makes a strong impression.',
    steps: [
      'Prepare a 10-minute overview of SkillfulMeans services tailored to their client base.',
      'Bring printed materials: one-pager, sample proposal, ROI case study.',
      'Ask about their top 3–5 clients who might benefit from mental wellness programs.',
      'Discuss their renewal calendar — when are clients up for renewal?',
      'Follow up with a summary email and clear next steps within 24 hours.',
      'If lunch: choose a restaurant they\'ll enjoy; relationship-building, not a sales pitch.',
      'If podcast: confirm recording date/time/platform; prepare 3–5 key talking points on mental fitness.',
    ],
  },
  proposal_sent: {
    label: 'Proposal Sent',
    description: 'Stay top of mind without being pushy — follow up with purpose.',
    steps: [
      'Follow up Day 3 with a quick check-in email.',
      'Follow up Day 7 with a call if no response.',
      'Follow up Day 14 with a final email offering to answer questions.',
      'Track if proposal link was viewed.',
      'If broker referred — update them on the proposal status.',
    ],
  },
  converted: {
    label: 'Won',
    description: 'Secure the commitment and kickstart the partnership.',
    steps: [
      'Send a formal confirmation email with next steps.',
      'Notify the referring broker with a thank you.',
      'Schedule a discovery call within 1 week to align on partnership details.',
      'Begin preparing onboarding tasks and client record setup.',
      'Add to monthly check-in cadence.',
    ],
  },
  not_interested: {
    label: 'Not Now',
    description: 'Keep the door open for future re-engagement.',
    steps: [
      'Thank them for their time and keep the connection warm.',
      'Add to the newsletter list for future nurture.',
      'Note their reason for passing — useful for future outreach.',
      'Set a 6-month reminder to re-engage if circumstances change.',
      'Monitor for company or role changes that may reopen the conversation.',
    ],
  },
};

export default function LeadPlaybookDialog({ stageKey, open, onClose }) {
  const playbook = LEAD_PLAYBOOKS[stageKey];
  if (!playbook) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#013f7c]">{playbook.label} — Playbook</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">{playbook.description}</p>
        </DialogHeader>
        <ul className="mt-2 space-y-3">
          {playbook.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#013f7c] mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700">{step}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}