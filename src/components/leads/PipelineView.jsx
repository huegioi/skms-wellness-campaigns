import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PipelineCard } from '@/components/shared/PipelineCard';
import { LEAD_STATUS_STAGES } from '@/components/shared/constants';
import { normalizeLeadStatus } from '@/lib/statusConfig';
import { LeadActivityStrip } from '@/components/leads/LeadActivityStrip';
import LeadPlaybookDialog from '@/components/leads/LeadPlaybookDialog';
import EngagementBoard from '@/components/leads/EngagementBoard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseISO, isToday, isPast } from 'date-fns';

// ── Status column definitions ────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { key: 'cold',              label: 'New',                accent: '#94a3b8', staleThreshold: 3 },
  { key: 'contacted',         label: 'Contacted',          accent: '#3b82f6', staleThreshold: 3 },
  { key: 'in_conversation',  label: 'In Conversation',   accent: '#a855f7', staleThreshold: 5 },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled',  accent: '#f59e0b', staleThreshold: 7 },
  { key: 'proposal_sent',    label: 'Proposal Sent',       accent: '#f97316', staleThreshold: 7 },
];

const CLOSED_COLUMNS = [
  { key: 'converted',     label: '✓ Won',     accent: '#22c55e', statuses: ['converted', 'current_client'] },
  { key: 'not_interested', label: '✗ Not Now', accent: '#ef4444', statuses: ['not_interested'] },
];

// Overlap stages: in both acquisition and engagement. Route to engagement only
// if the lead is an active partner; otherwise they fall through to status columns.
const OVERLAP_STAGES = new Set(['In-Person Meeting', 'In-Person Lunch']);

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
  if (!dueDateStatus) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {dueDateStatus === 'overdue' && (
        <span className="inline-flex items-center text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-1.5 py-0.5">
          ⚠ Overdue
        </span>
      )}
      {dueDateStatus === 'today' && (
        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-1.5 py-0.5">
          Due Today
        </span>
      )}
    </div>
  );
}

// ── Status Column ────────────────────────────────────────────────────────────

function StatusColumn({ col, leads, handlers, latestInteractionByLead, nextEventByLead, onPlaybook }) {
  const accent = col.accent;

  return (
    <div className="w-60 flex-shrink-0">
      <div
        className="rounded-xl px-3 py-2.5 mb-3 border"
        style={{ backgroundColor: `${accent}15`, color: accent, borderColor: `${accent}40` }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            className="text-sm font-semibold truncate text-left flex-1 hover:opacity-80 transition-opacity"
            onClick={() => onPlaybook(col.key)}
            title="Click to view playbook"
          >
            {col.label}
          </button>
          <span className="text-xs rounded-full px-2 py-0.5 font-bold bg-white/70 text-gray-700 shadow-sm">
            {leads.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={col.key}>
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
                    stages={LEAD_STATUS_STAGES}
                    stageValue={normalizeLeadStatus(lead.status)}
                    onStageChange={handlers.onStatusChange}
                    onOwnerChange={handlers.onOwnerChange}
                    onTagsChange={handlers.onTagsChange}
                    onFollowUpDateChange={handlers.onFollowUpDateChange}
                    onLogNote={handlers.onLogNote}
                    onOpenDetail={handlers.onOpenDetail}
                    onViewPlaybook={() => onPlaybook(normalizeLeadStatus(lead.status))}
                    onDelete={handlers.onDelete}
                    alertBadges={<LeadAlertBadges lead={lead} />}
                    accentColor={accent}
                    activityStrip={
                      <LeadActivityStrip
                        lead={lead}
                        latestInteraction={latestInteractionByLead[lead.id]}
                        nextEvent={nextEventByLead[lead.id]}
                        staleThreshold={col.staleThreshold}
                        onOwnerChange={handlers.onOwnerChange}
                        onFollowUpDateChange={handlers.onFollowUpDateChange}
                      />
                    }
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
    </div>
  );
}

// ── Section Banner ───────────────────────────────────────────────────────────

function SectionBanner({ label, gradient, count }) {
  return (
    <div
      className="flex items-center gap-3 px-6 py-4 rounded-xl mb-5 shadow-md"
      style={{ background: gradient }}
    >
      <span className="text-base font-bold tracking-wide text-white">{label}</span>
      <span className="text-xs font-semibold bg-white/20 text-white rounded-full px-2.5 py-0.5">
        {count} lead{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ── Main PipelineView ─────────────────────────────────────────────────────────

export default function PipelineView({ leads, onSelectLead, onStageChange }) {
  const queryClient = useQueryClient();
  const [noteDialog, setNoteDialog] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [playbookStatus, setPlaybookStatus] = useState(null);

  // Fetch interactions for activity strips (last touch)
  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions-pipeline'],
    queryFn: () => base44.entities.ClientInteraction.list('-date', 500),
  });

  // Fetch calendar events for activity strips (next)
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events-pipeline'],
    queryFn: () => base44.entities.CalendarEvent.list('start_date', 200),
  });

  // Latest interaction per lead_id
  const latestInteractionByLead = useMemo(() => {
    const map = {};
    for (const i of interactions) {
      if (!i.lead_id) continue;
      if (!map[i.lead_id] || new Date(i.date) > new Date(map[i.lead_id].date)) {
        map[i.lead_id] = i;
      }
    }
    return map;
  }, [interactions]);

  // Next upcoming calendar event per lead_id
  const nextEventByLead = useMemo(() => {
    const now = new Date();
    const map = {};
    for (const e of calendarEvents) {
      if (!e.lead_id) continue;
      const start = new Date(e.start_date);
      if (start < now) continue;
      if (!map[e.lead_id] || start < new Date(map[e.lead_id].start_date)) {
        map[e.lead_id] = e;
      }
    }
    return map;
  }, [calendarEvents]);

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow">
        <p className="text-gray-500">No leads to display in pipeline view.</p>
      </div>
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['leads'] });

  // ── Status change (internal — updates Lead.status) ──────────────────────────
  const handleStatusChange = async (leadId, newStatus) => {
    const status = newStatus || 'cold';
    const lead = leads.find(l => l.id === leadId);
    queryClient.setQueryData(['leads'], (old) =>
      (old || []).map(l => l.id === leadId ? { ...l, status } : l)
    );
    try {
      await base44.entities.Lead.update(leadId, { status });
      if (lead) {
        const sheetName = lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners';
        base44.functions.invoke('syncBrokerLeadsSheet', {
          action: 'updatePipelineStage',
          leadId,
          email: lead.email,
          sheetRowId: lead.sheet_row_id,
          sheetName,
          status,
        }).catch(e => console.warn('Sheet pipeline stage sync failed:', e));
      }
    } catch (e) {
      console.error('Status update failed:', e);
      refresh();
    }
  };

  // ── Engagement stage change (uses parent onStageChange — updates follow_up_stage) ─
  const handleStageChange = async (leadId, newStage) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    onStageChange(leadId, newStage);
    try {
      await base44.entities.Lead.update(leadId, { follow_up_stage: newStage || null });
      // No longer syncing follow_up_stage to the sheet — Pipeline Stage column is the canonical source
    } catch (e) {
      console.error('Stage update failed:', e);
      onStageChange(leadId, lead.follow_up_stage || '');
    }
  };

  const handleOwnerChange = async (leadId, owner) => {
    queryClient.setQueryData(['leads'], (old) =>
      (old || []).map(l => l.id === leadId ? { ...l, owner } : l)
    );
    try {
      await base44.entities.Lead.update(leadId, { owner });
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
    if (!destination || destination.droppableId === source.droppableId) return;

    const statusDroppableIds = new Set([
      ...STATUS_COLUMNS.map(c => c.key),
      ...CLOSED_COLUMNS.map(c => c.key),
    ]);

    if (statusDroppableIds.has(destination.droppableId)) {
      await handleStatusChange(draggableId, destination.droppableId);
    } else {
      const newStage = destination.droppableId === '__none__' ? '' : destination.droppableId;
      await handleStageChange(draggableId, newStage);
    }
  };

  const handlers = {
    onStatusChange: handleStatusChange,
    onStageChange: handleStageChange,
    onOwnerChange: handleOwnerChange,
    onTagsChange: handleTagsChange,
    onFollowUpDateChange: handleFollowUpDateChange,
    onLogNote: handleLogNote,
    onOpenDetail: onSelectLead,
    onDelete: handleDelete,
  };

  // Split leads: engagement vs status pipeline
  const ENGAGEMENT_SET = new Set([
    'New Referral Partner', 'Lunch & Learn', 'Active & Engaged',
    'In-Person Meeting', 'In-Person Lunch', 'Quarterly Review',
    'Renewal Season Outreach', 'Re-engage Partner', 'Inactive',
  ]);

  const isEngagement = (lead) => {
    const stage = lead.follow_up_stage || '';
    if (!ENGAGEMENT_SET.has(stage)) return false;
    if (OVERLAP_STAGES.has(stage)) {
      return lead.partner_status === 'active_partner';
    }
    return true;
  };

  const statusLeads = leads.filter(l => !isEngagement(l));
  const engagementLeads = leads.filter(l => isEngagement(l));

  // Group status leads by normalized status
  const statusMap = {};
  for (const lead of statusLeads) {
    const status = normalizeLeadStatus(lead.status);
    if (!statusMap[status]) statusMap[status] = [];
    statusMap[status].push(lead);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-10">

          {/* ── Status Pipeline ── */}
          {statusLeads.length > 0 && (
            <div>
              <SectionBanner
                label="🔵 Acquisition Pipeline"
                gradient="linear-gradient(135deg, #013f7c 0%, #012a54 100%)"
                count={statusLeads.length}
              />
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-5 min-w-max items-start">
                  {STATUS_COLUMNS.map(col => (
                    <StatusColumn
                      key={col.key}
                      col={col}
                      leads={statusMap[col.key] || []}
                      handlers={handlers}
                      latestInteractionByLead={latestInteractionByLead}
                      nextEventByLead={nextEventByLead}
                      onPlaybook={setPlaybookStatus}
                    />
                  ))}
                  {/* Closed sub-group */}
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide px-3">
                      Closed
                    </div>
                    <div className="flex gap-3">
                      {CLOSED_COLUMNS.map(col => {
                        const colLeads = (col.statuses || [col.key]).flatMap(
                          s => statusMap[s] || []
                        );
                        return (
                          <StatusColumn
                            key={col.key}
                            col={{ ...col, staleThreshold: null }}
                            leads={colLeads}
                            handlers={handlers}
                            latestInteractionByLead={latestInteractionByLead}
                            nextEventByLead={nextEventByLead}
                            onPlaybook={setPlaybookStatus}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Engagement Board (untouched) ── */}
          <EngagementBoard leads={engagementLeads} handlers={handlers} />

        </div>
      </DragDropContext>

      {/* Playbook Dialog */}
      <LeadPlaybookDialog
        stageKey={playbookStatus}
        open={!!playbookStatus}
        onClose={() => setPlaybookStatus(null)}
      />

      {/* Log Note Dialog */}
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