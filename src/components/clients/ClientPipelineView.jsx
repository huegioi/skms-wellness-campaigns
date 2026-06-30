import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MoreVertical, UserCog, StickyNote, Pencil, Trash2 } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { TagChips } from '@/components/ui/TagChips';
import StagePlaybookDialog from './StagePlaybookDialog';
import { OWNERS, CLIENT_STAGES } from '@/components/shared/constants';

const SALES_STAGES = CLIENT_STAGES.filter(s => s.group === 'Sales');
const LIFECYCLE_STAGES = CLIENT_STAGES.filter(s => s.group === 'Lifecycle');
const ALL_STAGE_KEYS = CLIENT_STAGES.map(s => s.key);
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

function RenewalBadge({ dateStr }) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return <span className="text-xs font-medium text-red-600">Expired</span>;
  if (days <= 30) return <span className="text-xs font-medium text-red-600">Renews in {days}d</span>;
  if (days <= 90) return <span className="text-xs font-medium text-amber-600">Renews in {days}d</span>;
  return <span className="text-xs text-gray-400">Renews in {days}d</span>;
}

function SalesAlertBadge({ client }) {
  const stage = client.client_stage;
  const stageEnteredDays = client.stage_entered_date ? daysAgo(client.stage_entered_date) : null;
  const lastActivityDays = daysAgo(client.last_contacted_date || client.last_contacted);

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

function ClientCard({ client, provided, snapshot, onOwnerChange, onLogNote, onEditInfo, onDelete, onClick, isSalesStage }) {
  const ago = daysAgo(client.last_contacted_date || client.last_contacted);
  const needsAttention = ago !== null && ago > 60 && NEEDS_ATTENTION_STAGES.has(client.client_stage);
  const hasBadges = needsAttention || (isSalesStage && (client.client_stage === 'proposal_sent' || client.client_stage === 'negotiation' || client.client_stage === 'discovery_call_scheduled'));

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`bg-white rounded-lg border p-3 shadow-sm transition-shadow cursor-grab active:cursor-grabbing select-none ${
        snapshot.isDragging ? 'shadow-lg border-[#264d44] ring-2 ring-[#264d44]/20 rotate-1' : 'border-gray-200 hover:shadow-md'
      }`}
      onClick={onClick}
    >
      {/* Header row: name + menu — tight layout */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="min-w-0">
          <p className="font-semibold text-[#264d44] text-sm leading-tight truncate">{client.company || client.name}</p>
          {client.company && <p className="text-xs text-gray-500 truncate">{client.name}</p>}
        </div>
        {/* Quick-action dropdown */}
        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <UserCog className="w-4 h-4" /> Assign Owner
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {OWNERS.map(owner => (
                    <DropdownMenuItem
                      key={owner}
                      className={client.owner === owner ? 'font-semibold text-[#264d44]' : ''}
                      onClick={() => onOwnerChange(client.id, owner)}
                    >
                      {client.owner === owner ? '✓ ' : ''}{owner}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem className="gap-2" onClick={() => onLogNote(client)}>
                <StickyNote className="w-4 h-4" /> Log Note
              </DropdownMenuItem>

              <DropdownMenuItem className="gap-2" onClick={() => onEditInfo(client)}>
                <Pencil className="w-4 h-4" /> Edit Info
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2 text-red-600 focus:text-red-600"
                onClick={() => {
                  if (window.confirm(`Delete ${client.company || client.name}? This cannot be undone.`)) {
                    onDelete(client.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Alert badges — only render row if there are badges */}
      {hasBadges && (
        <div className="flex flex-wrap gap-1 mb-1">
          {needsAttention && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
              ⚠ Needs attention
            </span>
          )}
          {isSalesStage && <SalesAlertBadge client={client} />}
        </div>
      )}

      {client.owner && <p className="text-xs text-gray-500 mb-0.5">👤 {client.owner}</p>}

      {client.tags?.length > 0 && (
        <div className="mb-0.5"><TagChips tags={client.tags} /></div>
      )}

      {ago !== null ? (
        <p className={`text-xs mb-0.5 ${ago > 60 ? 'text-red-500 font-medium' : ago > 30 ? 'text-amber-600' : 'text-gray-500'}`}>
          Last contact: {ago === 0 ? 'today' : `${ago}d ago`}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-0.5">No contact recorded</p>
      )}

      {client.renewal_date && (
        <div className="mb-0.5"><RenewalBadge dateStr={client.renewal_date} /></div>
      )}

      {((client.total_invoice_value || 0) > 0 || (client.purchased_services?.length || 0) > 0) && (
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
          {(client.total_invoice_value || 0) > 0 && (
            <span className="text-green-700 font-medium">${client.total_invoice_value.toLocaleString()}</span>
          )}
          {(client.purchased_services?.length || 0) > 0 && (
            <span>{client.purchased_services.length} service{client.purchased_services.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Drag hint */}
      {!snapshot.isDragging && (
        <p className="text-xs text-gray-300 mt-1.5 text-center select-none">⠿ drag to move stage</p>
      )}
    </div>
  );
}

function StageColumn({ stage, clients, onOwnerChange, onLogNote, onEditInfo, onDelete, onClientClick, onHeaderClick, isSalesStage }) {
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
                    <ClientCard
                      client={client}
                      provided={provided}
                      snapshot={snapshot}
                      onOwnerChange={onOwnerChange}
                      onLogNote={onLogNote}
                      onEditInfo={onEditInfo}
                      onDelete={onDelete}
                      onClick={() => !snapshot.isDragging && onClientClick(client)}
                      isSalesStage={isSalesStage}
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
  const [editDialog, setEditDialog] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [editForm, setEditForm] = useState({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

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

  const handleOwnerChange = async (clientId, owner) => {
    await base44.entities.Client.update(clientId, { owner });
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

  const handleEditInfo = (client) => {
    setEditForm({ name: client.name || '', company: client.company || '', email: client.email || '', phone: client.phone || '', owner: client.owner || '' });
    setEditDialog(client);
  };

  const handleSaveEdit = async () => {
    if (!editDialog) return;
    await base44.entities.Client.update(editDialog.id, editForm);
    refresh();
    setEditDialog(null);
  };

  const handleDelete = async (clientId) => {
    await base44.entities.Client.delete(clientId);
    refresh();
  };

  const filtered = ownerFilter && ownerFilter !== 'all'
    ? clients.filter(c => c.owner === ownerFilter)
    : clients;

  const stageClients = (key) => filtered.filter(c =>
    key === '__none__' ? !c.client_stage : c.client_stage === key
  );

  const salesTotal = SALES_STAGES.reduce((sum, s) => sum + stageClients(s.key).length, 0);
  const lifecycleTotal = LIFECYCLE_STAGES.reduce((sum, s) => sum + stageClients(s.key).length, 0);

  const columnProps = { onOwnerChange: handleOwnerChange, onLogNote: handleLogNote, onEditInfo: handleEditInfo, onDelete: handleDelete, onClientClick, onHeaderClick: setPlaybookStage };

  return (
    <>
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
                  <StageColumn key={stage.key} stage={stage} clients={stageClients(stage.key)} isSalesStage={false} {...columnProps} />
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

      {/* Edit Info Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit — {editDialog?.company || editDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Company" value={editForm.company || ''} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
            <Input placeholder="Contact Name" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            <Input type="email" placeholder="Email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <Input placeholder="Phone" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Owner</label>
              <Select value={editForm.owner || ''} onValueChange={(v) => setEditForm({ ...editForm, owner: v })}>
                <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
                <SelectContent>
                  {OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-[#264d44] hover:bg-[#1a3830]" onClick={handleSaveEdit}>Save</Button>
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}