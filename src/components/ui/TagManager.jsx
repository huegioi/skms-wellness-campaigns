import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { TAG_PALETTE } from '@/lib/tag-palette';
import { toast } from 'sonner';

export default function TagManager({ open, onOpenChange }) {
  const { tags } = useTags();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', color: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', color: TAG_PALETTE[0], description: '' });
  const [saving, setSaving] = useState(false);

  // Fetch usage counts
  const { data: usageData } = useQuery({
    queryKey: ['tagUsage'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTagUsage', {});
      return res.data?.usage || {};
    },
    enabled: open,
  });

  const startEdit = (tag) => {
    setEditingId(tag.id);
    setEditForm({ name: tag.name, color: tag.color, description: tag.description || '' });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const original = tags.find(t => t.id === editingId);
      const oldName = original?.name;
      const newName = editForm.name.trim();

      if (oldName && oldName !== newName) {
        // Rename with cascade via backend function
        await base44.functions.invoke('renameTag', {
          oldName,
          newName,
          color: editForm.color,
          description: editForm.description,
        });
        toast.success(`Renamed "${oldName}" → "${newName}" and cascaded to all records`);
      } else {
        // Just update color/description
        await base44.entities.Tag.update(editingId, {
          color: editForm.color,
          description: editForm.description,
        });
        toast.success('Tag updated');
      }

      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tagUsage'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setEditingId(null);
    } catch (e) {
      toast.error('Failed to update tag: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      await base44.entities.Tag.create({
        name: createForm.name.trim(),
        color: createForm.color,
        description: createForm.description,
      });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tagUsage'] });
      setCreateForm({ name: '', color: TAG_PALETTE[tags.length % TAG_PALETTE.length], description: '' });
      setCreating(false);
      toast.success('Tag created');
    } catch (e) {
      toast.error('Failed to create tag: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag) => {
    if (!window.confirm(`Delete "${tag.name}"? This will remove it from all leads, clients, and referral partners.`)) return;
    setSaving(true);
    try {
      await base44.functions.invoke('deleteTag', { name: tag.name });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tagUsage'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      toast.success(`Deleted "${tag.name}" and stripped from all records`);
    } catch (e) {
      toast.error('Failed to delete tag: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tag Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {tags.length === 0 && !creating && (
            <p className="text-sm text-gray-400 text-center py-6">No tags yet. Create one to get started.</p>
          )}

          {tags.map(tag => (
            <div key={tag.id} className="border rounded-lg p-3">
              {editingId === tag.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="flex-1"
                      placeholder="Tag name"
                    />
                    <Button size="icon" onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()} className="bg-[#264d44] hover:bg-[#1a3830] h-8 w-8">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => setEditingId(null)} className="h-8 w-8">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {TAG_PALETTE.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditForm({ ...editForm, color: c })}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: editForm.color === c ? '#fff' : 'transparent',
                          boxShadow: editForm.color === c ? `0 0 0 2px ${c}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                  <Textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description (optional)"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{tag.name}</p>
                    {tag.description && <p className="text-xs text-gray-500 truncate">{tag.description}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {usageData?.[tag.name] || 0} uses
                  </span>
                  <button onClick={() => startEdit(tag)} className="text-gray-400 hover:text-blue-600 p-1">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(tag)} disabled={saving} className="text-gray-400 hover:text-red-600 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Create new tag */}
          {creating ? (
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex items-center gap-2">
                <Input
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  className="flex-1 bg-white"
                  placeholder="Tag name"
                  autoFocus
                />
                <Button size="icon" onClick={handleCreate} disabled={saving || !createForm.name.trim()} className="bg-[#264d44] hover:bg-[#1a3830] h-8 w-8">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => setCreating(false)} className="h-8 w-8">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {TAG_PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setCreateForm({ ...createForm, color: c })}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: createForm.color === c ? '#fff' : 'transparent',
                      boxShadow: createForm.color === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
              <Textarea
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                className="text-sm bg-white"
              />
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2 mt-2" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> New Tag
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}