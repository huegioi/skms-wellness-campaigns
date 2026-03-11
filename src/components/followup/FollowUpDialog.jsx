import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, ExternalLink, Plus, Trash2 } from 'lucide-react';
import GmailPickerDialog from './GmailPickerDialog';

const defaultForm = {
  title: '',
  description: '',
  contact_name: '',
  contact_email: '',
  contact_type: 'client',
  source: 'manual',
  source_link: '',
  source_snippet: '',
  gmail_message_id: '',
  gmail_thread_id: '',
  priority: 'medium',
  status: 'pending',
  due_date: '',
  reminder_date: '',
  client_id: ''
};

export default function FollowUpDialog({ open, onClose, task, onSave }) {
  const [form, setForm] = useState(defaultForm);
  const [showGmailPicker, setShowGmailPicker] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['clientsForFollowUp'],
    queryFn: () => base44.entities.Client.list(),
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (task) {
      setForm({
        ...defaultForm,
        ...task,
        due_date: task.due_date || '',
        reminder_date: task.reminder_date ? task.reminder_date.slice(0, 16) : ''
      });
    } else {
      setForm(defaultForm);
    }
    setNewNote('');
  }, [task, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleGmailSelect = (data) => {
    setForm(f => ({ ...f, ...data }));
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note = { note: newNote.trim(), date: new Date().toISOString() };
    set('progress_notes', [...(form.progress_notes || []), note]);
    setNewNote('');
  };

  const removeNote = (idx) => {
    set('progress_notes', (form.progress_notes || []).filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      reminder_sent: task?.reminder_sent || false
    };
    if (task?.id) {
      await base44.entities.FollowUpTask.update(task.id, payload);
    } else {
      await base44.entities.FollowUpTask.create(payload);
    }
    setSaving(false);
    onSave();
    onClose();
  };

  const priorityColors = { low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700', urgent: 'bg-purple-100 text-purple-700' };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{task?.id ? 'Edit Follow-Up' : 'New Follow-Up Task'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Gmail Source Banner */}
            {form.source === 'gmail' && form.source_link && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-700">Created from Gmail</p>
                  {form.source_snippet && <p className="text-xs text-blue-600 mt-0.5 line-clamp-2 italic">"{form.source_snippet}"</p>}
                </div>
                <a href={form.source_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 flex-shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Import from Gmail */}
            {!task?.id && (
              <Button variant="outline" onClick={() => setShowGmailPicker(true)} className="w-full border-dashed gap-2 text-[#264d44] border-[#264d44]">
                <Mail className="w-4 h-4" />
                Import from Gmail Email
              </Button>
            )}

            {/* Title */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title / Subject *</label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be followed up?" />
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contact Name</label>
                <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contact Email</label>
                <Input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="email@example.com" />
              </div>
            </div>

            {/* Contact Type + Client Link */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Contact Type</label>
                <Select value={form.contact_type} onValueChange={v => set('contact_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="team_member">Team Member</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Link to Client (optional)</label>
                <Select value={form.client_id || 'none'} onValueChange={v => set('client_id', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
                <Select value={form.priority} onValueChange={v => set('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Low</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="high">🔴 High</SelectItem>
                    <SelectItem value="urgent">🚨 Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_on_them">Waiting on Them</SelectItem>
                    <SelectItem value="snoozed">Snoozed</SelectItem>
                    <SelectItem value="completed">Completed ✓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Due Date</label>
                <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Reminder Date & Time</label>
                <Input type="datetime-local" value={form.reminder_date} onChange={e => { set('reminder_date', e.target.value); set('reminder_sent', false); }} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description / Action Items</label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What needs to happen? Any context..." rows={3} />
            </div>

            {/* Progress log */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Progress Log</label>
              {(form.progress_notes || []).length > 0 && (
                <div className="space-y-2 mb-2">
                  {(form.progress_notes || []).map((n, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-2.5 flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="text-gray-700">{n.note}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                      <button onClick={() => removeNote(i)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a progress note..." onKeyDown={e => e.key === 'Enter' && addNote()} />
                <Button variant="outline" size="icon" onClick={addNote}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="bg-[#264d44] hover:bg-[#1a3830] text-white">
              {saving ? 'Saving...' : task?.id ? 'Save Changes' : 'Create Follow-Up'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <GmailPickerDialog open={showGmailPicker} onClose={() => setShowGmailPicker(false)} onSelect={handleGmailSelect} />
    </>
  );
}