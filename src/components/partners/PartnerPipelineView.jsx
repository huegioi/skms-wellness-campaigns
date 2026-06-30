import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ExternalLink, Check, Users, DollarSign } from 'lucide-react';
import { PipelineCard } from '@/components/shared/PipelineCard';
import { PARTNER_STAGES } from '@/components/shared/constants';

function PartnerAlertBadges({ partner, referrals }) {
  const partnerReferrals = referrals.filter(r => r.referral_partner_id === partner.id);
  const totalCommission = partnerReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  return (
    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
      <span className="flex items-center gap-1 text-blue-700">
        <Users className="w-3 h-3" />
        {partnerReferrals.length} ref{partnerReferrals.length !== 1 ? 's' : ''}
      </span>
      {totalCommission > 0 && (
        <span className="flex items-center gap-1 text-green-700">
          <DollarSign className="w-3 h-3" />
          ${totalCommission.toLocaleString()}
        </span>
      )}
    </div>
  );
}

function StageColumn({ stage, partners, referrals, onOwnerChange, onStageChange, onTagsChange, onFollowUpDateChange, onLogNote, onCopyLink, copiedId, onSelectPartner, onDelete }) {
  return (
    <div className="w-56 flex-shrink-0">
      <div className={`rounded-t-lg border px-3 py-2 mb-2 ${stage.headerClass}`}>
        <div className="flex items-center justify-between">
          <span className={`font-semibold text-sm ${stage.textClass}`}>{stage.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${stage.textClass}`}>
            {partners.length}
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
              snapshot.isDraggingOver ? 'bg-[#013f7c]/5 ring-2 ring-[#013f7c]/20' : ''
            }`}
          >
            {partners.length === 0 && !snapshot.isDraggingOver ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                Drop here
              </div>
            ) : (
              partners.map((partner, index) => (
                <Draggable key={partner.id} draggableId={partner.id} index={index}>
                  {(provided, snapshot) => (
                    <PipelineCard
                      record={partner}
                      provided={provided}
                      snapshot={snapshot}
                      title={partner.name}
                      subtitle={partner.company}
                      stages={PARTNER_STAGES}
                      stageValue={partner.partner_status}
                      onStageChange={onStageChange}
                      onOwnerChange={onOwnerChange}
                      onTagsChange={onTagsChange}
                      onFollowUpDateChange={onFollowUpDateChange}
                      onLogNote={onLogNote}
                      onOpenDetail={onSelectPartner}
                      onDelete={onDelete}
                      alertBadges={<PartnerAlertBadges partner={partner} referrals={referrals} />}
                      accentColor="#013f7c"
                      extraActions={
                        <>
                          <button
                            onClick={() => onCopyLink(partner)}
                            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            title="Copy portal link"
                          >
                            {copiedId === partner.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={`/ReferralPortal?id=${partner.unique_portal_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            title="Open portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      }
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

export default function PartnerPipelineView({ partners, referrals, onSelectPartner }) {
  const queryClient = useQueryClient();
  const [noteDialog, setNoteDialog] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['referralPartners'] });

  const handleOwnerChange = async (partnerId, owner) => {
    await base44.entities.ReferralPartner.update(partnerId, { owner });
    refresh();
  };

  const handleStageChange = async (partnerId, newStatus) => {
    const updatePayload = { partner_status: newStatus || null };
    if (newStatus === 'Active Partner') updatePayload.is_active = true;
    if (newStatus !== 'Active Partner') updatePayload.is_active = false;
    await base44.entities.ReferralPartner.update(partnerId, updatePayload);
    refresh();
  };

  const handleTagsChange = async (partnerId, tags) => {
    await base44.entities.ReferralPartner.update(partnerId, { tags });
    refresh();
  };

  const handleFollowUpDateChange = async (partnerId, dateStr) => {
    await base44.entities.ReferralPartner.update(partnerId, { follow_up_due_date: dateStr });
    refresh();
  };

  const handleDelete = async (partnerId) => {
    await base44.entities.ReferralPartner.delete(partnerId);
    refresh();
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId === '__none__' ? null : destination.droppableId;
    const updatePayload = { partner_status: newStatus };
    if (newStatus === 'Active Partner') updatePayload.is_active = true;
    if (source.droppableId === 'Active Partner' && newStatus !== 'Active Partner') updatePayload.is_active = false;
    await base44.entities.ReferralPartner.update(draggableId, updatePayload);
    refresh();
  };

  const handleLogNote = (partner) => {
    setNoteText('');
    setNoteDialog(partner);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !noteDialog) return;
    const existing = noteDialog.notes || '';
    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newNotes = existing ? `${existing}\n\n[${timestamp}] ${noteText.trim()}` : `[${timestamp}] ${noteText.trim()}`;
    await base44.entities.ReferralPartner.update(noteDialog.id, { notes: newNotes });
    refresh();
    setNoteDialog(null);
  };

  const handleCopyLink = (partner) => {
    const url = `${window.location.origin}/ReferralPortal?id=${partner.unique_portal_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stagePartners = (key) =>
    key === '__none__'
      ? partners.filter(p => !p.partner_status)
      : partners.filter(p => p.partner_status === key);

  const columnProps = {
    onOwnerChange: handleOwnerChange,
    onStageChange: handleStageChange,
    onTagsChange: handleTagsChange,
    onFollowUpDateChange: handleFollowUpDateChange,
    onLogNote: handleLogNote,
    onCopyLink: handleCopyLink,
    copiedId,
    onSelectPartner,
    onDelete: handleDelete,
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {PARTNER_STAGES.map(stage => (
              <StageColumn
                key={stage.key}
                stage={stage}
                partners={stagePartners(stage.key)}
                referrals={referrals}
                {...columnProps}
              />
            ))}
          </div>
        </div>
      </DragDropContext>

      <Dialog open={!!noteDialog} onOpenChange={open => !open && setNoteDialog(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>Log Note — {noteDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea placeholder="Enter your note..." rows={4} value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
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