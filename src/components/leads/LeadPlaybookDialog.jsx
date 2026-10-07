import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

/**
 * Playbook coaching content organized by the new Lead.status stages.
 * No data writes — purely informational checklist guidance.
 */
const LEAD_PLAYBOOKS = {
  cold: {
    label: 'To contact',
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
    label: 'In sequence',
    description: 'Outreach is under way. Work the cadence (about 6 touches over 3 weeks), then park the lead as Not now if nothing comes back. The app moves leads here automatically when the first email goes out.',
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
    label: 'Talking',
    description: 'They replied — from here Maya reminds you about them individually. Move toward a meeting while interest is warm.',
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
    label: 'Meeting booked',
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
  met: {
    label: 'Met — next step',
    description: 'The meeting happened. Log how it went and the one next step you agreed — Maya keeps asking until you do.',
    steps: [
      'Log the outcome (held / no-show / rescheduled) and the agreed next step on the card.',
      'Send a recap email within 24 hours restating that next step and its date.',
      'If they are ready: send the partner agreement and move them to Onboarding.',
      'If it was a no-show: reschedule once, then return them to In sequence.',
      'Ask for 1–2 specific employer groups they could introduce in the next renewal cycle.',
    ],
  },
  onboarding: {
    label: 'Onboarding',
    description: 'They said yes. Get them set up so their first referral is easy.',
    steps: [
      'Send (or confirm signature of) the referral partner agreement.',
      'Send their referral portal link and a 2-minute walkthrough.',
      'Give them the broker one-pager and the HR program guide to forward.',
      'Agree the first client to introduce, and a date.',
      'The lead moves to Active partner automatically when their first referral is approved.',
    ],
  },
  active_partner: {
    label: 'Active partner',
    description: 'Their first referral is approved. Now keep the relationship producing.',
    steps: [
      'Thank them personally for the first referral.',
      'Keep them posted on how the referred client is doing.',
      'Set a quarterly check-in and invite them to Lunch & Learns.',
      'Bring them into renewal-season planning for their book.',
    ],
  },
  converted: {
    label: 'Won — client',
    description: 'A company inquiry that became a client.',
    steps: [
      'Send a formal confirmation email with next steps.',
      'Begin preparing onboarding tasks and client record setup.',
    ],
  },
  not_a_fit: {
    label: 'Not a fit',
    description: 'Closed for good — note why so the pattern shows up across leads.',
    steps: [
      'Record the reason (e.g. no group-benefits book, wrong region).',
      'Remove from active outreach campaigns.',
    ],
  },
  not_interested: {
    label: 'Not now',
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