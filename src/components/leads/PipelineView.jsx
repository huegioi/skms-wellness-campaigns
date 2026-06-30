import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Building, User, Calendar, AlertCircle, ChevronDown, X, Info } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { TagChips } from '@/components/ui/TagChips';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import { PipelineCard } from '@/components/shared/PipelineCard';
import { LEAD_STAGES } from '@/components/shared/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ── Stage Definitions ────────────────────────────────────────────────────────

const ACQUISITION_STAGES = [
  'Event Follow-up',
  'Day 1 - LinkedIn Connection',
  'Day 2 - Send email #1',
  'Day 3 - Call #1',
  'Day 3 - Text f/u to call',
  'Day 5 - Call #2',
  'Day 5 - LinkedIn f/u message',
  'Day 7 - Send email #2',
  'Day 10 - Call #3',
  'Day 10 - Send email #3',
  'Day 11 - LinkedIn message #3',
  'Day 15 - Send email #4',
  'Day 20 - Send email #5',
  'In-Person Meeting',
  'In-Person Lunch',
  'Podcast',
  'Podcast Follow-up',
  'NABIP ?',
  'NABIP Yes',
  'NABIP No',
];

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

// ── Action Steps ─────────────────────────────────────────────────────────────

const ACTION_STEPS = {
  'Day 1 - LinkedIn Connection': [
    'Send a personalized LinkedIn connection request mentioning a mutual interest or shared connection.',
    "Note: do not pitch — just connect and mention you'd love to share what you do.",
    "Add them to your CRM with today's date and mark follow-up for Day 2.",
  ],
  'Day 2 - Send email #1': [
    "Send a brief intro email — who you are, what SKMS does, and why you're reaching out.",
    'Keep it under 5 sentences. Include one specific, relevant detail about their company or industry.',
    'End with a clear, low-friction ask: "Would you be open to a quick 15-minute call?"',
  ],
  'Day 3 - Call #1': [
    'Call their direct line or office number.',
    'If they answer: briefly introduce yourself and reference your email, then ask for a short call.',
    "If voicemail: leave a 20-second message — name, company, what you do, and that you'll follow up by text.",
  ],
  'Day 3 - Text f/u to call': [
    'Send a short, professional text following up on your call attempt.',
    'Reference that you left a voicemail and would love a quick 15 minutes.',
    'Do not pitch — just acknowledge you reached out and keep the door open.',
  ],
  'Day 5 - Call #2': [
    'Second call attempt. Try at a different time of day than Day 3.',
    "If voicemail again: mention you sent an email and a text — \"I don't want to be a nuisance, just want to connect for 15 minutes.\"",
    'Note the outcome in CRM.',
  ],
  'Day 5 - LinkedIn f/u message': [
    'Send a LinkedIn message as a soft follow-up to your connection request.',
    'Reference your email if they accepted. If not yet connected, send a note with the request.',
    'Keep it conversational — no pitch. One or two sentences max.',
  ],
  'Day 7 - Send email #2': [
    'Second email with a different angle — lead with a client success story or ROI data.',
    'Example: "One of our broker partners referred a 200-person company — they saw X% stress reduction in 60 days."',
    'Reiterate the ask: 15-minute intro call.',
  ],
  'Day 10 - Call #3': [
    'Third and final call attempt.',
    'If answered: focus on their clients\' needs — "Most HR teams we work with are struggling with X. Does that resonate?"',
    "If voicemail: keep it brief and mention you'll send one final email.",
  ],
  'Day 10 - Send email #3': [
    'Third email — make it about them, not you. Ask a question about their book of business.',
    'Example: "Are any of your clients renewing benefits this fall? We often see the best ROI for groups of 50–300."',
    'Include a one-pager PDF or link to the SKMS overview.',
  ],
  'Day 11 - LinkedIn message #3': [
    'Final LinkedIn touch — short and direct.',
    "Example: \"Hey [Name] — I've reached out a few times. Happy to make it easy: here's a link to schedule a 15-min intro call. [link]\"",
    "Leave the door open but don't overdo it.",
  ],
  'Day 15 - Send email #4': [
    "The \"breakup\" email — communicate you won't keep following up, but leave a strong impression.",
    "Example: \"I'll stop reaching out after this, but wanted to share one last thing that might be relevant...\"",
    'Include a compelling stat or case study relevant to their market.',
  ],
  'Day 20 - Send email #5': [
    'Final touch — brief, low-pressure, and future-focused.',
    "Example: \"Circling back one last time. If the timing isn't right, no worries — I'll keep you in mind for future opportunities.\"",
    "Offer a simple resource: \"Here's our one-pager if you ever want to share it with a client.\"",
  ],
  'In-Person Meeting': [
    'Prepare a 10-minute overview of SKMS services tailored to their client base.',
    'Bring printed materials: one-pager, sample proposal, ROI case study.',
    'Ask about their top 3–5 clients who might benefit from mental wellness programs.',
    'Discuss their renewal calendar — when are clients up for renewal?',
    'Follow up with a summary email and clear next steps within 24 hours.',
  ],
  'In-Person Lunch': [
    "Choose a restaurant they'll enjoy — this is relationship-building, not a sales pitch.",
    "Ask about their business, their challenges, and what's working for their clients.",
    "Mention SKMS naturally when relevant, but don't dominate the conversation.",
    'Learn what they value in vendor relationships.',
    'Send a thank-you note same day. Schedule next touchpoint before the lunch ends.',
  ],
  'Podcast': [
    'Confirm recording date, time, and platform (Zoom, Riverside, etc.).',
    'Send a brief bio and headshot if requested.',
    'Prepare 3–5 key talking points on mental fitness and workplace wellness.',
    'Research the host and their audience to tailor your message.',
    'Follow up with the host after recording to confirm release timeline.',
  ],
  'Podcast Follow-up': [
    'Send a thank-you email to the host within 24 hours of recording.',
    'Share the episode on LinkedIn and tag the host when it goes live.',
    'Follow up with any listeners who reach out after the episode.',
    "Ask the host if they know other brokers or HR leaders who could benefit from SKMS's programs.",
    'Add the podcast link to your marketing materials and partner outreach.',
  ],
  'NABIP ?': [
    'Confirm attendance at the NABIP event.',
    'Research attendees and identify top broker targets to connect with.',
    'Prepare your elevator pitch and bring printed SKMS materials.',
    'Collect business cards and log new contacts in CRM same day.',
    'Send follow-up emails within 48 hours of the event.',
  ],
  'NABIP Yes': [
    'Log the contact as interested in partnering with SKMS.',
    'Send a follow-up email with the SKMS overview and partnership details.',
    'Schedule a discovery call within 1 week.',
    'Add to the broker pipeline and assign a follow-up stage.',
    'Note any specific interests or client needs they mentioned at the event.',
  ],
  'NABIP No': [
    'Thank them for their time and keep the connection warm.',
    'Add to the newsletter list for future nurture.',
    'Note their reason for passing — useful for future outreach.',
    'Set a 6-month reminder to re-engage if circumstances change.',
    'Monitor for company or role changes that may reopen the conversation.',
  ],
  'New Referral Partner': [
    'Send welcome email with SKMS overview and marketing materials.',
    'Set expectations: "Here\'s how we work together."',
    'Share a sample proposal they can show their clients.',
    'Schedule an intro call to discuss their book of business.',
    'Add to monthly check-in cadence.',
  ],
  'Event Follow-up': [
    'Send a personalized follow-up email within 48 hours of the event.',
    'Reference something specific you discussed to jog their memory.',
    'Share a relevant resource — case study, one-pager, or ROI data.',
    'Propose a quick 15-minute discovery call to continue the conversation.',
    'Connect on LinkedIn if not already connected.',
    'Log the event name and date in CRM for future reference.',
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
    'Invite to SKMS webinars and events.',
    'Send Mental Health Month co-marketing materials in April.',
    'Celebrate their referrals — thank them within 24 hours of each one.',
  ],
  'Quarterly Review': [
    'Review referral activity for the quarter — how many sent, how many converted.',
    'Share ROI data from their referred clients\' programs.',
    'Discuss upcoming renewal seasons for their clients.',
    'Plan the next quarter\'s collaboration.',
    'Ask: "Who else in your network should know about SKMS?"',
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

// ── Section theme config ──────────────────────────────────────────────────────

const SECTION_THEMES = {
  engagement: {
    headerGradient: 'linear-gradient(135deg, #264d44 0%, #1a3830 100%)',
    columnHeaderBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    columnHeaderHover: 'hover:bg-emerald-100',
    cardBorder: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-700',
    dropdownSection: 'bg-green-50 text-green-700 border-green-100',
    dropdownHover: 'hover:bg-green-50',
    dropdownActive: 'bg-green-50 text-green-700 font-semibold',
    countBadge: 'bg-white/20 text-white',
  },
  acquisition: {
    headerGradient: 'linear-gradient(135deg, #013f7c 0%, #012a54 100%)',
    columnHeaderBg: 'bg-blue-50 text-blue-800 border border-blue-200',
    columnHeaderHover: 'hover:bg-blue-100',
    cardBorder: 'border-l-blue-500',
    badgeBg: 'bg-blue-100 text-blue-700',
    dropdownSection: 'bg-blue-50 text-blue-700 border-blue-100',
    dropdownHover: 'hover:bg-blue-50',
    dropdownActive: 'bg-blue-50 text-blue-700 font-semibold',
    countBadge: 'bg-white/20 text-white',
  },
  none: {
    columnHeaderBg: 'bg-gray-100 text-gray-600 border border-gray-200',
    cardBorder: 'border-l-gray-300',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSection(lead) {
  const stage = lead.follow_up_stage || '';
  if (!stage) return 'none';
  if (ENGAGEMENT_STAGES.includes(stage)) {
    if (ACQUISITION_STAGES.includes(stage)) {
      return lead.partner_status === 'active_partner' ? 'engagement' : 'acquisition';
    }
    return 'engagement';
  }
  if (ACQUISITION_STAGES.includes(stage)) return 'acquisition';
  return 'none';
}

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

// ── Action Steps Popup ────────────────────────────────────────────────────────

function ActionStepsPopup({ stage, onClose }) {
  const steps = ACTION_STEPS[stage];
  if (!steps) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-5 z-10"
        onClick={e => e.stopPropagation()}
      >
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
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
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

// ── Alert Badges ──────────────────────────────────────────────────────────────

function LeadAlertBadges({ lead }) {
  const dueDateStatus = getDueDateStatus(lead.follow_up_due_date);
  const isActivePartner = lead.partner_status === 'active_partner';

  if (!dueDateStatus && !isActivePartner) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {dueDateStatus === 'overdue' && (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-1.5 py-0.5">
          <AlertCircle className="w-2.5 h-2.5" /> Overdue
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

// ── Pipeline Column ───────────────────────────────────────────────────────────

function PipelineColumn({ stage, leads, handlers, section }) {
  const [showPopup, setShowPopup] = useState(false);
  const theme = SECTION_THEMES[section] || SECTION_THEMES.none;
  const overdueCount = leads.filter(l => getDueDateStatus(l.follow_up_due_date) === 'overdue').length;
  const dueTodayCount = leads.filter(l => getDueDateStatus(l.follow_up_due_date) === 'today').length;
  const hasActionSteps = !!ACTION_STEPS[stage];
  const accentColor = section === 'engagement' ? '#264d44' : section === 'acquisition' ? '#013f7c' : '#6b7280';

  const headerClass = stage === '' ? 'bg-gray-100 text-gray-600 border border-gray-200' : theme.columnHeaderBg;
  const droppableId = stage || '__none__';

  return (
    <div className="w-64 flex-shrink-0">
      <div className={`rounded-xl px-3 py-2.5 mb-3 ${headerClass}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-sm font-semibold truncate text-left flex-1 hover:opacity-80 transition-opacity"
            onClick={() => hasActionSteps && setShowPopup(true)}
            title={hasActionSteps ? 'Click to see action steps' : undefined}
          >
            {stage || 'No Stage'}
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
        {(overdueCount > 0 || dueTodayCount > 0) && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {overdueCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-medium">
                {overdueCount} overdue
              </span>
            )}
            {dueTodayCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-medium">
                {dueTodayCount} due today
              </span>
            )}
          </div>
        )}
      </div>

      <Droppable droppableId={droppableId}>
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

// ── Section Banner ────────────────────────────────────────────────────────────

function SectionBanner({ label, gradient, count }) {
  return (
    <div
      className="flex items-center gap-3 px-6 py-4 rounded-xl mb-5 shadow-md"
      style={{ background: gradient }}
    >
      <span className="text-base font-bold tracking-wide text-white">{label}</span>
      <span className="text-xs font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5">
        {count} partner{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ── Main PipelineView ─────────────────────────────────────────────────────────

export default function PipelineView({ leads, onSelectLead, onStageChange }) {
  const queryClient = useQueryClient();
  const [noteDialog, setNoteDialog] = useState(null);
  const [noteText, setNoteText] = useState('');

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow">
        <p className="text-gray-500">No partners to display in pipeline view.</p>
      </div>
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['leads'] });

  const handleStageChange = async (leadId, newStage) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    onStageChange(leadId, newStage);
    try {
      await base44.entities.Lead.update(leadId, { follow_up_stage: newStage || null });
      const sheetName = lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners';
      base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updateStage',
        leadId,
        email: lead.email,
        sheetRowId: lead.sheet_row_id,
        sheetName,
        follow_up_stage: newStage,
      }).catch(e => console.warn('Sheet sync failed:', e));
    } catch (e) {
      console.error('Stage update failed:', e);
      onStageChange(leadId, lead.follow_up_stage || '');
    }
  };

  const handleOwnerChange = async (leadId, owner) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    queryClient.setQueryData(['leads'], (old) =>
      (old || []).map(l => l.id === leadId ? { ...l, owner } : l)
    );
    try {
      await base44.entities.Lead.update(leadId, { owner });
      const sheetName = lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners';
      base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updateOwner',
        leadId,
        email: lead.email,
        sheetRowId: lead.sheet_row_id,
        sheetName,
        owner,
      }).catch(e => console.warn('Sheet owner sync failed:', e));
    } catch (e) {
      console.error('Owner update failed:', e);
      refresh();
    }
  };

  const handleTagsChange = async (leadId, tags) => {
    queryClient.setQueryData(['leads'], (old) =>
      (old || []).map(l => l.id === leadId ? { ...l, tags } : l)
    );
    try {
      await base44.entities.Lead.update(leadId, { tags });
    } catch (e) {
      console.error('Tags update failed:', e);
      refresh();
    }
  };

  const handleFollowUpDateChange = async (leadId, dateStr) => {
    queryClient.setQueryData(['leads'], (old) =>
      (old || []).map(l => l.id === leadId ? { ...l, follow_up_due_date: dateStr } : l)
    );
    try {
      await base44.entities.Lead.update(leadId, { follow_up_due_date: dateStr });
    } catch (e) {
      console.error('Follow-up date update failed:', e);
      refresh();
    }
  };

  const handleLogNote = (lead) => {
    setNoteText('');
    setNoteDialog(lead);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !noteDialog) return;
    const existing = noteDialog.notes || '';
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newNotes = existing ? `${existing}\n\n[${timestamp}] ${noteText.trim()}` : `[${timestamp}] ${noteText.trim()}`;
    await base44.entities.Lead.update(noteDialog.id, { notes: newNotes, last_contacted_date: new Date().toISOString().split('T')[0] });
    refresh();
    setNoteDialog(null);
  };

  const handleDelete = async (leadId) => {
    await base44.entities.Lead.delete(leadId);
    refresh();
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const newStage = destination.droppableId === '__none__' ? '' : destination.droppableId;
    await handleStageChange(draggableId, newStage);
  };

  const handlers = {
    onStageChange: handleStageChange,
    onOwnerChange: handleOwnerChange,
    onTagsChange: handleTagsChange,
    onFollowUpDateChange: handleFollowUpDateChange,
    onLogNote: handleLogNote,
    onOpenDetail: onSelectLead,
    onDelete: handleDelete,
  };

  const noStageLeads = leads.filter(l => !l.follow_up_stage);

  const acquisitionMap = {};
  const engagementMap = {};

  for (const lead of leads) {
    const stage = lead.follow_up_stage || '';
    if (!stage) continue;
    const section = getSection(lead);
    if (section === 'acquisition') {
      if (!acquisitionMap[stage]) acquisitionMap[stage] = [];
      acquisitionMap[stage].push(lead);
    } else if (section === 'engagement') {
      if (!engagementMap[stage]) engagementMap[stage] = [];
      engagementMap[stage].push(lead);
    }
  }

  const acqStages = ACQUISITION_STAGES.filter(s => acquisitionMap[s]?.length > 0);
  const engStages = ENGAGEMENT_STAGES.filter(s => engagementMap[s]?.length > 0);

  const acqCount = acqStages.reduce((sum, s) => sum + (acquisitionMap[s]?.length || 0), 0);
  const engCount = engStages.reduce((sum, s) => sum + (engagementMap[s]?.length || 0), 0);

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-10">

          {noStageLeads.length > 0 && (
            <div>
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl mb-5 bg-gray-200 shadow-sm">
                <span className="text-sm font-bold tracking-wide text-gray-600">⬜ No Stage</span>
                <span className="text-xs font-semibold bg-white/60 text-gray-600 rounded-full px-2.5 py-0.5">
                  {noStageLeads.length} partner{noStageLeads.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-5 min-w-max">
                  <PipelineColumn stage="" leads={noStageLeads} handlers={handlers} section="none" />
                </div>
              </div>
            </div>
          )}

          {engStages.length > 0 && (
            <div>
              <SectionBanner label="🟢 Partner Engagement" gradient={SECTION_THEMES.engagement.headerGradient} count={engCount} />
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-5 min-w-max">
                  {engStages.map(stage => (
                    <PipelineColumn key={stage} stage={stage} leads={engagementMap[stage]} handlers={handlers} section="engagement" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {acqStages.length > 0 && (
            <div>
              <SectionBanner label="🔵 Partner Acquisition" gradient={SECTION_THEMES.acquisition.headerGradient} count={acqCount} />
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-5 min-w-max">
                  {acqStages.map(stage => (
                    <PipelineColumn key={stage} stage={stage} leads={acquisitionMap[stage]} handlers={handlers} section="acquisition" />
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </DragDropContext>

      <Dialog open={!!noteDialog} onOpenChange={(open) => !open && setNoteDialog(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>Log Note — {noteDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea placeholder="Enter your note..." rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button className="flex-1 bg-[#013f7c] hover:bg-[#012d5a]" onClick={handleSaveNote} disabled={!noteText.trim()}>Save Note</Button>
              <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}