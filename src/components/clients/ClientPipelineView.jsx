import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { differenceInDays, parseISO } from 'date-fns';
import { PipelineCard } from '@/components/shared/PipelineCard';
import StagePlaybookDialog from './StagePlaybookDialog';
import { CLIENT_STAGES } from '@/components/shared/constants';
import { useClientDeliveryStatus } from '@/hooks/useClientDeliveryStatus';
import ClientDeliveryStrip from '@/components/clients/ClientDeliveryStrip';
import RenewalSeasonBanner from '@/components/clients/RenewalSeasonBanner';
import ReferredByBadge from '@/components/shared/ReferredByBadge';
import { getActiveCohort, hasRenewalReviewBooked } from '@/lib/renewal';

const SALES_STAGES = CLIENT_STAGES.filter(s => s.group === 'Sales');
const LIFECYCLE_STAGES = CLIENT_STAGES.filter(s => s.group === 'Lifecycle');
const NEEDS_ATTENTION_STAGES = new Set(['nurture', 'program_delivery']);

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

function SalesAlertBadge({ client }) {
  const stage = client.client_stage;
  const stageEnteredDays = client.stage_entered_date ? daysAgo(client.stage_entered_date) : null;
  const lastActivityDays = daysAgo(client.last_contacted_date);

  if (stage === 'proposal_sent') {
    const staleDays = lastActivityDays ?? stageEnteredDays;
    if (staleDays !== null && staleDays >= 7) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
          ⏰ Follow up needed
        </span>
      );
    }
  }

  if (stage === 'discovery_call_scheduled' && client.plan_year_start) {
    const daysLeft = daysUntil(client.plan_year_start);
    if (daysLeft !== null && daysLeft < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-2 py-0.5">
          🔴 Call overdue
        </span>
      );
    }
  }

  if (stage === 'negotiation' && stageEnteredDays !== null && stageEnteredDays >= 14) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
        ⚠ Stalling
      </span>
    );
  }

  return null;
}

function ClientAlertBadges({ client, isSalesStage }) {
  const ago = daysAgo(client.last_contacted_date);
  const needsAttention = ago !== null && ago > 60 && NEEDS_ATTENTION_STAGES.has(client.client_stage);
  const hasBadges = needsAttention || (isSalesStage && (client.client_stage === 'proposal_sent' || client.client_stage === 'negotiation' || client.client_stage === 'discovery_call_scheduled'));

  if (!hasBadges) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {needsAttention && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
          ⚠ Needs attention
        </span>
      )}
      {isSalesStage && <SalesAlertBadge client={client} />}
    </div>
  );
}

function StageColumn({ stage, clients, onOwnerChange, onStageChange, onTagsChange, onFollowUpDateChange, onLogNote, onDelete, onClientClick, onHeaderClick, isSalesStage, snapshots }) {
  return (
    <div className="w-56 flex-shrink-0">
      <div
        className={`rounded-t-lg border px-3 py-2 mb-2 ${stage.headerClass} ${stage.key !== '__none__' ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
        onClick={() => stage.key !== '__none__' && onHeaderClick(stage.key)}
        title={stage.key !== '__none__' ? 'Click to view action steps' : undefined}
      >
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-sm ${stage.textClass}`}>{stage.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.textClass}`}>
            {clients.length}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stage.desc}</p>
      </div>

      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2 min-h-[60px] rounded-b-lg transition-colors ${
              snapshot.isDraggingOver ? 'bg-[#264d44]/5 ring-2 ring-[#264d44]/20' : ''
            }`}
          >
            {clients.length === 0 && !snapshot.isDraggingOver ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                Drop here
              </div>
            ) : (
              clients.map((client, index) => (
                <Draggable key={client.id} draggableId={client.id} index={index}>
                  {(provided, snapshot) => (
                    <PipelineCard
                      record={client}
                      provided={provided}
                      snapshot={snapshot}
                      title={client.company || client.name}
                      subtitle={client.company ? client.name : null}
                      stages={CLIENT_STAGES}
                      stageValue={client.client_stage}
                      onStageChange={onStageChange}
                      onOwnerChange={onOwnerChange}
                      onTagsChange={onTagsChange}
                      onFollowUpDateChange={onFollowUpDateChange}
                      onLogNote={onLogNote}
                      onOpenDetail={onClientClick}
                      onViewPlaybook={(c) => onHeaderClick(c.client_stage)}
                      onDelete={onDelete}
                      alertBadges={
                        <>
                          {client.referral_partner_name && (
                            <div className="mb-1">
                              <ReferredByBadge partnerId={client.referral_partner_id} partnerName={client.referral_partner_name} compact />
                            </div>
                          )}
                          <ClientAlertBadges client={client} isSalesStage={isSalesStage} />
                          {!isSalesStage && <ClientDeliveryStrip snapshot={snapshots?.[client.id]} client={client} />}
                        </>
                      }
                      accentColor="#264d44"
                    />
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function ClientPipelineView({ clients, ownerFilter, onClientClick }) {
  const queryClient = useQueryClient();
  const [playbookStage, setPlaybookStage] = useState(null);
  const [noteDialog, setNoteDialog] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [cohortFilter, setCohortFilter] = useState(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  // Reuse the delivery hook's events cache for "renewal review booked" checks
  const { data: renewalEvents = [] } = useQuery({
    queryKey: ['delivery-events'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 500),
  });
  const activeCohort = useMemo(() => getActiveCohort(), []);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStage = destination.droppableId === '__none__' ? null : destination.droppableId;
    await base44.entities.Client.update(draggableId, {
      client_stage: newStage,
      stage_entered_date: new Date().toISOString().split('T')[0],
    });
    refresh();
  };

  const handleStageChange = async (clientId, newStage) => {
    await base44.entities.Client.update(clientId, {
      client_stage: newStage || null,
      stage_entered_date: new Date().toISOString().split('T')[0],
    });
    refresh();
  };

  const handleOwnerChange = async (clientId, owner) => {
    await base44.entities.Client.update(clientId, { owner });
    refresh();
  };

  const handleTagsChange = async (clientId, tags) => {
    await base44.entities.Client.update(clientId, { tags });
    refresh();
  };

  const handleFollowUpDateChange = async (clientId, dateStr) => {
    await base44.entities.Client.update(clientId, { follow_up_due_date: dateStr });
    refresh();
  };

  const handleLogNote = (client) => {
    setNoteText('');
    setNoteDialog(client);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !noteDialog) return;
    const existing = noteDialog.notes || '';
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newNotes = existing ? `${existing}\n\n[${timestamp}] ${noteText.trim()}` : `[${timestamp}] ${noteText.trim()}`;
    await base44.entities.Client.update(noteDialog.id, { notes: newNotes, last_contacted_date: new Date().toISOString().split('T')[0] });
    refresh();
    setNoteDialog(null);
  };

  const handleDelete = async (clientId) => {
    await base44.entities.Client.delete(clientId);
    refresh();
  };

  const filtered = useMemo(() => ownerFilter && ownerFilter !== 'all'
    ? clients.filter(c => c.owner === ownerFilter)
    : clients, [clients, ownerFilter]);

  const snapshots = useClientDeliveryStatus(filtered);

  // Renewal-season banner stats (full owner-filtered set, ignoring cohort filter)
  const cohortClients = activeCohort
    ? filtered.filter(c => c.renewal_cohort === activeCohort.label && c.client_stage !== 'churned')
    : [];
  const reviewsBooked = cohortClients.filter(c => hasRenewalReviewBooked(c, renewalEvents)).length;
  const unscheduledInCohort = cohortClients.filter(c => (snapshots[c.id]?.unscheduledServices?.length || 0) > 0).length;

  const displayClients = cohortFilter ? filtered.filter(c => c.renewal_cohort === cohortFilter) : filtered;

  const stageClients = (key) => displayClients.filter(c =>
    key === '__none__' ? !c.client_stage : c.client_stage === key
  );

  const salesTotal = SALES_STAGES.reduce((sum, s) => sum + stageClients(s.key).length, 0);
  const lifecycleTotal = LIFECYCLE_STAGES.reduce((sum, s) => sum + stageClients(s.key).length, 0);

  const columnProps = {
    onOwnerChange: handleOwnerChange,
    onStageChange: handleStageChange,
    onTagsChange: handleTagsChange,
    onFollowUpDateChange: handleFollowUpDateChange,
    onLogNote: handleLogNote,
    onDelete: handleDelete,
    onClientClick,
    onHeaderClick: setPlaybookStage,
  };

  return (
    <>
      <RenewalSeasonBanner
        activeCohort={activeCohort}
        cohortClients={cohortClients}
        reviewsBooked={reviewsBooked}
        unscheduledCount={unscheduledInCohort}
        cohortFilter={cohortFilter}
        onToggleFilter={() => setCohortFilter(cohortFilter === activeCohort?.label ? null : activeCohort?.label)}
      />
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex flex-col gap-4 min-w-max">

            {/* ── Sales Pipeline ── */}
            <div>
              <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)' }}>
                <span className="text-white font-bold text-sm tracking-wide">🔵 Sales Pipeline</span>
                <span className="ml-auto text-blue-100 text-xs font-medium">{salesTotal} prospect{salesTotal !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex gap-4">
                {SALES_STAGES.map(stage => (
                  <StageColumn key={stage.key} stage={stage} clients={stageClients(stage.key)} isSalesStage={true} {...columnProps} />
                ))}
              </div>
            </div>

            {/* ── Client Lifecycle ── */}
            <div>
              <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #166534 0%, #16a34a 100%)' }}>
                <span className="text-white font-bold text-sm tracking-wide">🟢 Client Lifecycle</span>
                <span className="ml-auto text-green-100 text-xs font-medium">{lifecycleTotal} client{lifecycleTotal !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex gap-4">
                {LIFECYCLE_STAGES.map(stage => (
                  <StageColumn key={stage.key} stage={stage} clients={stageClients(stage.key)} isSalesStage={false} snapshots={snapshots} {...columnProps} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </DragDropContext>

      <StagePlaybookDialog stageKey={playbookStage} open={!!playbookStage} onClose={() => setPlaybookStage(null)} />

      {/* Log Note Dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(open) => !open && setNoteDialog(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>Log Note — {noteDialog?.company || noteDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea placeholder="Enter your note..." rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button className="flex-1 bg-[#264d44] hover:bg-[#1a3830]" onClick={handleSaveNote} disabled={!noteText.trim()}>Save Note</Button>
              <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}