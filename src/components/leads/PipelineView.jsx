import React, { useState, useEffect, useRef } from 'react';
import { Building, User, Calendar, AlertCircle, ChevronDown, X, Info } from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';

// ── Stage Definitions ────────────────────────────────────────────────────────

const ACQUISITION_STAGES = [
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

const ALL_STAGES = [
  '',
  ...ACQUISITION_STAGES,
  ...ENGAGEMENT_STAGES.filter(s => !ACQUISITION_STAGES.includes(s)),
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
  'New Referral Partner': [
    'Send welcome email with SKMS overview and marketing materials.',
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

// ── Colors ────────────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  '': 'bg-gray-100 text-gray-700 border-gray-200',
  'Day 1 - LinkedIn Connection': 'bg-blue-50 text-blue-700 border-blue-200',
  'Day 2 - Send email #1': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Day 3 - Call #1': 'bg-purple-50 text-purple-700 border-purple-200',
  'Day 3 - Text f/u to call': 'bg-pink-50 text-pink-700 border-pink-200',
  'Day 5 - Call #2': 'bg-red-50 text-red-700 border-red-200',
  'Day 5 - LinkedIn f/u message': 'bg-orange-50 text-orange-700 border-orange-200',
  'Day 7 - Send email #2': 'bg-amber-50 text-amber-700 border-amber-200',
  'Day 10 - Call #3': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Day 10 - Send email #3': 'bg-lime-50 text-lime-700 border-lime-200',
  'Day 11 - LinkedIn message #3': 'bg-green-50 text-green-700 border-green-200',
  'Day 15 - Send email #4': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Day 20 - Send email #5': 'bg-teal-50 text-teal-700 border-teal-200',
  'In-Person Meeting': 'bg-emerald-100 text-emerald-900 border-emerald-400',
  'In-Person Lunch': 'bg-green-100 text-green-900 border-green-400',
  'New Referral Partner': 'bg-sky-50 text-sky-700 border-sky-200',
  'Lunch & Learn': 'bg-violet-50 text-violet-700 border-violet-200',
  'Active & Engaged': 'bg-green-100 text-green-800 border-green-300',
  'Quarterly Review': 'bg-blue-100 text-blue-800 border-blue-300',
  'Renewal Season Outreach': 'bg-amber-100 text-amber-800 border-amber-300',
  'Re-engage Partner': 'bg-orange-100 text-orange-800 border-orange-300',
  'Inactive': 'bg-gray-200 text-gray-600 border-gray-300',
};

function getStageColor(stage) {
  return STAGE_COLORS[stage] || 'bg-gray-100 text-gray-700 border-gray-200';
}

// For engagement stages that also appear in acquisition (In-Person Meeting/Lunch),
// determine which section based on partner_status
function getSection(lead) {
  const stage = lead.follow_up_stage || '';
  if (!stage) return 'none';
  if (ENGAGEMENT_STAGES.includes(stage)) {
    // If it's shared (In-Person Meeting/Lunch), check partner_status
    if (ACQUISITION_STAGES.includes(stage)) {
      return lead.partner_status === 'active_partner' ? 'engagement' : 'acquisition';
    }
    return 'engagement';
  }
  if (ACQUISITION_STAGES.includes(stage)) return 'acquisition';
  return 'none';
}

const ACQUISITION_ORDER = ['', ...ACQUISITION_STAGES];
const ENGAGEMENT_ORDER = ENGAGEMENT_STAGES;

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

// ── Stage Dropdown ────────────────────────────────────────────────────────────

function StageDropdown({ currentStage, onStageChange, saving }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (stage) => {
    setOpen(false);
    if (stage !== currentStage) onStageChange(stage);
  };

  return (
    <div className="relative mt-2" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className="w-full flex items-center justify-between gap-1 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md px-2 py-1 text-gray-600 font-medium transition-colors disabled:opacity-50"
      >
        <span className="truncate">{currentStage || 'Set stage…'}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl overflow-y-auto max-h-72">
          <button
            onClick={() => handleSelect('')}
            className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors ${currentStage === '' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-400 italic'}`}
          >
            — No Stage —
          </button>
          <div className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 border-y border-blue-100">
            🔵 Partner Acquisition
          </div>
          {ACQUISITION_STAGES.map((stage, i) => (
            <button
              key={i}
              onClick={() => handleSelect(stage)}
              className={`w-full text-left text-xs px-3 py-2 hover:bg-blue-50 transition-colors ${stage === currentStage ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
            >
              {stage}
            </button>
          ))}
          <div className="px-3 py-1 text-xs font-bold text-green-700 bg-green-50 border-y border-green-100">
            🟢 Partner Engagement
          </div>
          {ENGAGEMENT_STAGES.map((stage, i) => (
            <button
              key={i}
              onClick={() => handleSelect(stage)}
              className={`w-full text-left text-xs px-3 py-2 hover:bg-green-50 transition-colors ${stage === currentStage ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-700'}`}
            >
              {stage}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Partner Card ──────────────────────────────────────────────────────────────

function PartnerCard({ lead, onClick, onStageChange }) {
  const [saving, setSaving] = useState(false);
  const [localStage, setLocalStage] = useState(lead.follow_up_stage || '');

  useEffect(() => {
    setLocalStage(lead.follow_up_stage || '');
  }, [lead.follow_up_stage]);

  const dueDateStatus = getDueDateStatus(lead.follow_up_due_date);
  const isActivePartner = lead.partner_status === 'active_partner';

  const cardBg =
    dueDateStatus === 'overdue' ? 'bg-red-50 border border-red-200' :
    dueDateStatus === 'today' ? 'bg-amber-50 border border-amber-200' :
    'bg-white border border-gray-200';

  const handleStageChange = async (newStage) => {
    setSaving(true);
    setLocalStage(newStage);
    try {
      await base44.entities.Lead.update(lead.id, { follow_up_stage: newStage || null });
      if (onStageChange) onStageChange(lead.id, newStage);
      const sheetName = lead.sheet_origin?.replace('BrokerLeads:', '') || undefined;
      base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updateStage',
        leadId: lead.id,
        sheetRowId: lead.sheet_row_id,
        sheetName,
        follow_up_stage: newStage,
      }).catch(e => console.warn('Sheet sync failed (non-critical):', e));
    } catch (e) {
      console.error('Stage update failed', e);
      setLocalStage(lead.follow_up_stage || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-full rounded-lg p-3 shadow-sm hover:shadow-md transition-all ${cardBg}`}>
      <button onClick={() => onClick && onClick(lead)} className="w-full text-left">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="font-semibold text-gray-800 text-sm leading-tight">{lead.name}</p>
          {dueDateStatus === 'overdue' && (
            <span className="flex-shrink-0 text-xs bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
              <AlertCircle className="w-2.5 h-2.5" /> Overdue
            </span>
          )}
          {dueDateStatus === 'today' && (
            <span className="flex-shrink-0 text-xs bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-semibold">
              Due Today
            </span>
          )}
        </div>
        {lead.company && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Building className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.company}</span>
          </p>
        )}
        {lead.owner && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
            <User className="w-3 h-3 flex-shrink-0" />
            {lead.owner}
          </p>
        )}
        {lead.follow_up_due_date && (
          <p className={`text-xs flex items-center gap-1 mt-1 font-medium ${
            dueDateStatus === 'overdue' ? 'text-red-600' :
            dueDateStatus === 'today' ? 'text-amber-700' :
            'text-gray-500'
          }`}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>Follow-up: {format(parseISO(lead.follow_up_due_date), 'MMM d, yyyy')}</span>
          </p>
        )}
        {isActivePartner && (
          <div className="mt-1.5">
            <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
              Active Partner
            </span>
          </div>
        )}
      </button>
      <StageDropdown currentStage={localStage} onStageChange={handleStageChange} saving={saving} />
      {saving && <p className="text-xs text-blue-500 mt-1">Saving…</p>}
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function PipelineColumn({ stage, leads, onSelectLead, onStageChange }) {
  const [showPopup, setShowPopup] = useState(false);
  const overdueCount = leads.filter(l => getDueDateStatus(l.follow_up_due_date) === 'overdue').length;
  const dueTodayCount = leads.filter(l => getDueDateStatus(l.follow_up_due_date) === 'today').length;
  const hasActionSteps = !!ACTION_STEPS[stage];

  return (
    <div className="w-64 flex-shrink-0">
      <div className={`rounded-xl shadow-sm px-3 py-2.5 mb-3 border ${getStageColor(stage)}`}>
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-sm font-semibold truncate text-left hover:underline flex-1"
            onClick={() => hasActionSteps && setShowPopup(true)}
            title={hasActionSteps ? 'Click to see action steps' : undefined}
          >
            {stage || 'No Stage'}
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasActionSteps && (
              <button onClick={() => setShowPopup(true)} className="opacity-50 hover:opacity-100 transition-opacity">
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-xs rounded-full px-2 py-0.5 font-bold bg-white/50">
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
      <div className="space-y-2">
        {leads.map(lead => (
          <PartnerCard
            key={lead.id}
            lead={lead}
            onClick={onSelectLead}
            onStageChange={onStageChange}
          />
        ))}
      </div>
      {showPopup && <ActionStepsPopup stage={stage} onClose={() => setShowPopup(false)} />}
    </div>
  );
}

// ── Section Banner ────────────────────────────────────────────────────────────

function SectionBanner({ label, colorClass, count }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl mb-4 ${colorClass}`}>
      <span className="text-base font-bold tracking-wide">{label}</span>
      <span className="text-xs font-semibold bg-white/40 rounded-full px-2 py-0.5">{count} partner{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

// ── Main PipelineView ─────────────────────────────────────────────────────────

export default function PipelineView({ leads, onSelectLead, onStageChange }) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow">
        <p className="text-gray-500">No partners to display in pipeline view.</p>
      </div>
    );
  }

  // Bucket leads by section
  const noStageLeads = leads.filter(l => !l.follow_up_stage);

  // For shared stages (In-Person Meeting/Lunch) — route by partner_status
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

  // Only show columns that have at least one partner
  const acqStages = ACQUISITION_ORDER.slice(1).filter(s => acquisitionMap[s]?.length > 0);
  const engStages = ENGAGEMENT_ORDER.filter(s => engagementMap[s]?.length > 0);

  const acqCount = acqStages.reduce((sum, s) => sum + (acquisitionMap[s]?.length || 0), 0);
  const engCount = engStages.reduce((sum, s) => sum + (engagementMap[s]?.length || 0), 0);

  return (
    <div className="space-y-8">
      {/* No Stage */}
      {noStageLeads.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            <PipelineColumn
              stage=""
              leads={noStageLeads}
              onSelectLead={onSelectLead}
              onStageChange={onStageChange}
            />
          </div>
        </div>
      )}

      {/* Partner Acquisition Section */}
      {acqStages.length > 0 && (
        <div>
          <SectionBanner
            label="🔵 Partner Acquisition"
            colorClass="bg-blue-600 text-white"
            count={acqCount}
          />
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {acqStages.map(stage => (
                <PipelineColumn
                  key={stage}
                  stage={stage}
                  leads={acquisitionMap[stage]}
                  onSelectLead={onSelectLead}
                  onStageChange={onStageChange}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Partner Engagement Section */}
      {engStages.length > 0 && (
        <div>
          <SectionBanner
            label="🟢 Partner Engagement"
            colorClass="bg-green-600 text-white"
            count={engCount}
          />
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {engStages.map(stage => (
                <PipelineColumn
                  key={stage}
                  stage={stage}
                  leads={engagementMap[stage]}
                  onSelectLead={onSelectLead}
                  onStageChange={onStageChange}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}