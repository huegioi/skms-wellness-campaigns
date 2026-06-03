import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ExternalLink, Check, Users, DollarSign } from 'lucide-react';

const PARTNER_STAGES = [
  { key: 'Prospect',       label: 'Prospect',       desc: 'Identified, outreach not yet started',     headerClass: 'bg-sky-50 border-sky-200',     textClass: 'text-sky-700' },
  { key: 'Active Partner', label: 'Active Partner',  desc: 'Agreement signed, actively referring',      headerClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' },
  { key: 'Inactive',       label: 'Inactive',        desc: 'No recent referrals or engagement',         headerClass: 'bg-gray-100 border-gray-300',   textClass: 'text-gray-500' },
  { key: '__none__',       label: 'No Stage',        desc: 'Partners with no stage set yet',            headerClass: 'bg-slate-50 border-slate-200',  textClass: 'text-slate-500' },
];

function PartnerCard({ partner, provided, snapshot, referrals, onLogNote, onCopyLink, copiedId }) {
  const partnerReferrals = referrals.filter(r => r.referral_partner_id === partner.id);
  const totalCommission = partnerReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`bg-white rounded-lg border p-3 shadow-sm transition-shadow cursor-grab active:cursor-grabbing select-none ${
        snapshot.isDragging ? 'shadow-lg border-[#013f7c] ring-2 ring-[#013f7c]/20 rotate-1' : 'border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="min-w-0">
          <p className="font-semibold text-[#013f7c] text-sm leading-tight truncate">{partner.name}</p>
          {partner.company && <p className="text-xs text-gray-500 truncate">{partner.company}</p>}
        </div>
        <div onClick={e => e.stopPropagation()} className="flex gap-1 flex-shrink-0">
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
        </div>
      </div>

      <p className="text-xs text-gray-400 truncate">{partner.email}</p>

      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1 text-blue-700">
          <Users className="w-3 h-3" />
          {partnerReferrals.length} referral{partnerReferrals.length !== 1 ? 's' : ''}
        </span>
        {totalCommission > 0 && (
          <span className="flex items-center gap-1 text-green-700">
            <DollarSign className="w-3 h-3" />
            ${totalCommission.toLocaleString()}
          </span>
        )}
      </div>

      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onLogNote(partner)}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          + log note
        </button>
      </div>

      {!snapshot.isDragging && (
        <p className="text-xs text-gray-300 mt-1.5 text-center select-none">⠿ drag to move stage</p>
      )}
    </div>
  );
}

function StageColumn({ stage, partners, referrals, onLogNote, onCopyLink, copiedId }) {
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
                    <PartnerCard
                      partner={partner}
                      provided={provided}
                      snapshot={snapshot}
                      referrals={referrals}
                      onLogNote={onLogNote}
                      onCopyLink={onCopyLink}
                      copiedId={copiedId}
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

export default function PartnerPipelineView({ partners, referrals }) {
  const queryClient = useQueryClient();
  const [noteDialog, setNoteDialog] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['referralPartners'] });

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId === '__none__' ? null : destination.droppableId;
    await base44.entities.ReferralPartner.update(draggableId, { partner_status: newStatus });
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
                onLogNote={handleLogNote}
                onCopyLink={handleCopyLink}
                copiedId={copiedId}
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