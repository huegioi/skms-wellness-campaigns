import React, { useState } from 'react';
import { X, Info } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { PipelineCard } from '@/components/shared/PipelineCard';
import { LEAD_STAGES } from '@/components/shared/constants';
import { parseISO, isToday, isPast } from 'date-fns';

// ── Engagement stages (unchanged) ────────────────────────────────────────────

const ENGAGEMENT_STAGES = [
  'New Referral Partner',
  'Lunch & Learn',
  'Active & Engaged',
  'In-Person Meeting',
  'In-Person Lunch',
  'Quarterly Review',
  'Renewal Season Outreach',
  'Re-engage Partner',
  'Inactive',
];

// ── Action Steps (engagement board coaching content) ─────────────────────────

const ACTION_STEPS = {
  'New Referral Partner': [
    'Send welcome email with SkillfulMeans overview and marketing materials.',
    'Set expectations: "Here\'s how we work together."',
    'Share a sample proposal they can show their clients.',
    'Schedule an intro call to discuss their book of business.',
    'Add to monthly check-in cadence.',
  ],
  'Lunch & Learn': [
    'Schedule a Lunch & Learn at their office for their team.',
    'Prepare a 30-minute presentation on mental fitness campaigns.',
    'Bring wellness box samples as leave-behinds.',
    'Collect business cards from attendees.',
    'Follow up with attendees within 48 hours.',
  ],
  'Active & Engaged': [
    'Monthly check-in call or email.',
    'Share new case studies and ROI data quarterly.',
    'Invite to SkillfulMeans webinars and events.',
    'Send Mental Health Month co-marketing materials in April.',
    'Celebrate their referrals — thank them within 24 hours of each one.',
  ],
  'In-Person Meeting': [
    'Prepare a 10-minute overview of SkillfulMeans services tailored to their client base.',
    'Bring printed materials: one-pager, sample proposal, ROI case study.',
    'Ask about their top 3–5 clients who might benefit from mental wellness programs.',
    'Discuss their renewal calendar — when are clients up for renewal?',
    'Follow up with a summary email and clear next steps within 24 hours.',
  ],
  'In-Person Lunch': [
    'Choose a restaurant they\'ll enjoy — this is relationship-building, not a sales pitch.',
    'Ask about their business, their challenges, and what\'s working for their clients.',
    'Mention SkillfulMeans naturally when relevant, but don\'t dominate the conversation.',
    'Learn what they value in vendor relationships.',
    'Send a thank-you note same day. Schedule next touchpoint before the lunch ends.',
  ],
  'Quarterly Review': [
    'Review referral activity for the quarter — how many sent, how many converted.',
    'Share ROI data from their referred clients\' programs.',
    'Discuss upcoming renewal seasons for their clients.',
    'Plan the next quarter\'s collaboration.',
    'Ask: "Who else in your network should know about SkillfulMeans?"',
  ],
  'Renewal Season Outreach': [
    'Identify which of their clients are renewing in the next 90 days.',
    'Prepare proposals for each renewal opportunity.',
    'Offer to present directly to their client\'s HR team.',
    'Coordinate timing: "When does your client need to see proposals by?"',
    'Follow up weekly during renewal season.',
  ],
  'Re-engage Partner': [
    'Send a personal check-in email — not salesy.',
    'Share a recent success story or case study.',
    'Offer a free resource or Lunch & Learn as a re-entry point.',
    'Call them directly if no email response within 5 days.',
    'If no response after 3 touches over 3 weeks — move to Inactive.',
  ],
  'Inactive': [
    'Set a 6-month reminder to try again.',
    'Keep them on the newsletter list.',
    'Monitor if they change companies — that\'s a re-engagement trigger.',
    'When re-engaging: lead with something new, not "we miss you."',
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDueDateStatus(dueDateStr) {
  if (!dueDateStr) return null;
  try {
    const date = parseISO(dueDateStr);
    if (isToday(date)) return 'today';
    if (isPast(date)) return 'overdue';
    return 'upcoming';
  } catch {
    return null;
  }
}

function LeadAlertBadges({ lead }) {
  const dueDateStatus = getDueDateStatus(lead.follow_up_due_date);
  const isActivePartner = lead.partner_status === 'active_partner';
  if (!dueDateStatus && !isActivePartner) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {dueDateStatus === 'overdue' && (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-1.5 py-0.5">
          ⚠ Overdue
        </span>
      )}
      {dueDateStatus === 'today' && (
        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-1.5 py-0.5">
          Due Today
        </span>
      )}
      {isActivePartner && (
        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
          Active Partner
        </span>
      )}
    </div>
  );
}

// ── Action Steps Popup ────────────────────────────────────────────────────────

function ActionStepsPopup({ stage, onClose }) {
  const steps = ACTION_STEPS[stage];
  if (!steps) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-5 z-10" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-base leading-tight pr-4">{stage}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Action Steps</p>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-gray-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Engagement Column ─────────────────────────────────────────────────────────

function EngagementColumn({ stage, leads, handlers, channelSummaryByLead }) {
  const [showPopup, setShowPopup] = useState(false);
  const hasActionSteps = !!ACTION_STEPS[stage];
  const accentColor = '#264d44';

  return (
    <div className="w-64 flex-shrink-0">
      <div className="rounded-xl px-3 py-2.5 mb-3 bg-emerald-50 text-emerald-800 border border-emerald-200">
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-sm font-semibold truncate text-left flex-1 hover:opacity-80 transition-opacity"
            onClick={() => hasActionSteps && setShowPopup(true)}
            title={hasActionSteps ? 'Click to see action steps' : undefined}
          >
            {stage}
          </button>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasActionSteps && (
              <button onClick={() => setShowPopup(true)} className="opacity-50 hover:opacity-100 transition-opacity">
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-xs rounded-full px-2 py-0.5 font-bold bg-white/70 text-gray-700 shadow-sm">
              {leads.length}
            </span>
          </div>
        </div>
      </div>

      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2.5 min-h-[60px] rounded-b-lg transition-colors ${
              snapshot.isDraggingOver ? 'bg-gray-50 ring-2 ring-gray-200' : ''
            }`}
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(provided, snapshot) => (
                  <PipelineCard
                    record={lead}
                    provided={provided}
                    snapshot={snapshot}
                    title={lead.name}
                    subtitle={lead.company || null}
                    stages={LEAD_STAGES}
                    stageValue={lead.follow_up_stage}
                    onStageChange={handlers.onStageChange}
                    onOwnerChange={handlers.onOwnerChange}
                    onTagsChange={handlers.onTagsChange}
                    onFollowUpDateChange={handlers.onFollowUpDateChange}
                    onLogNote={handlers.onLogNote}
                    onOpenDetail={handlers.onOpenDetail}
                    onViewPlaybook={() => setShowPopup(true)}
                    onDelete={handlers.onDelete}
                    alertBadges={<LeadAlertBadges lead={lead} />}
                    accentColor={accentColor}
                    linkedinUrl={lead.linkedin_url}
                    onLogLinkedinTouch={(note) => handlers.onLogLinkedinTouch(lead.id, note)}
                    channelSummary={channelSummaryByLead?.[lead.id]}
                  />
                )}
              </Draggable>
            ))}
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                Drop here
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {showPopup && hasActionSteps && <ActionStepsPopup stage={stage} onClose={() => setShowPopup(false)} />}
    </div>
  );
}

// ── Main EngagementBoard ─────────────────────────────────────────────────────

export default function EngagementBoard({ leads, handlers, channelSummaryByLead }) {
  const engagementSet = new Set(ENGAGEMENT_STAGES);
  const engagementLeads = leads.filter(l => engagementSet.has(l.follow_up_stage));

  const map = {};
  for (const lead of engagementLeads) {
    const stage = lead.follow_up_stage;
    if (!map[stage]) map[stage] = [];
    map[stage].push(lead);
  }

  const stages = ENGAGEMENT_STAGES.filter(s => map[s]?.length > 0);
  const count = stages.reduce((sum, s) => sum + map[s].length, 0);

  if (stages.length === 0) return null;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-6 py-4 rounded-xl mb-5 shadow-md"
        style={{ background: 'linear-gradient(135deg, #264d44 0%, #1a3830 100%)' }}
      >
        <span className="text-base font-bold tracking-wide text-white">🟢 Partner Engagement</span>
        <span className="text-xs font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5">
          {count} partner{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-5 min-w-max">
          {stages.map(stage => (
            <EngagementColumn key={stage} stage={stage} leads={map[stage]} handlers={handlers} channelSummaryByLead={channelSummaryByLead} />
          ))}
        </div>
      </div>
    </div>
  );
}