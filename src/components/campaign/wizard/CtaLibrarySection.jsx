import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Calls-to-Action library section for the New Campaign wizard.
 * Lists active CampaignCta records as toggle switches (default OFF), sorted by
 * sort_order. Supports adding a new CTA inline (auto-enabled + toggled ON) and
 * editing/deactivating an existing CTA. Deactivating hides it from future
 * campaigns; records are never deleted.
 *
 * Reports the selected CTAs up to the wizard as a snapshot
 * ({ label, url, guidance }[]) so later library edits don't mutate the
 * in-flight campaign.
 */
export default function CtaLibrarySection({ onSelectedCtasChange, initialCtas = [] }) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);
  const [newCta, setNewCta] = useState({ label: '', url: '', guidance: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', url: '', guidance: '' });
  const initializedRef = useRef(false);

  const { data: ctas = [], isLoading } = useQuery({
    queryKey: ['campaign_ctas'],
    queryFn: () => base44.entities.CampaignCta.filter({ is_active: true }, 'sort_order', 100),
  });

  // Sync the selection snapshot up to the wizard form whenever selection or
  // library data changes. Self-corrects after the create-refetch lands.
  useEffect(() => {
    const records = ctas.filter(c => selectedIds.includes(c.id));
    onSelectedCtasChange(records.map(c => ({ label: c.label, url: c.url, guidance: c.guidance || '' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, ctas]);

  // Pre-select library records that match the initialCtas snapshot (by
  // label+url). Runs once when the library first loads. Records that were
  // deactivated since the snapshot was taken simply won't match (and are
  // dropped from selection). Used by the follow-up launch dialog to default
  // to the campaign's original selected_ctas.
  useEffect(() => {
    if (initializedRef.current || ctas.length === 0) return;
    initializedRef.current = true;
    if (initialCtas.length === 0) return;
    const matches = ctas.filter(c =>
      initialCtas.some(ic => ic.label === c.label && ic.url === c.url)
    );
    if (matches.length > 0) setSelectedIds(matches.map(c => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctas]);

  const nextSortOrder = ctas.length > 0 ? Math.max(...ctas.map(c => c.sort_order ?? 0)) + 1 : 0;

  const createMutation = useMutation({
    mutationFn: () => base44.entities.CampaignCta.create({
      label: newCta.label.trim(),
      url: newCta.url.trim(),
      guidance: newCta.guidance.trim() || undefined,
      is_active: true,
      sort_order: nextSortOrder,
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['campaign_ctas'] });
      setSelectedIds(prev => [...prev, created.id]);
      setNewCta({ label: '', url: '', guidance: '' });
      toast.success('Call to action added');
    },
    onError: () => toast.error('Failed to add call to action'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CampaignCta.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_ctas'] });
      setEditingId(null);
      toast.success('Call to action updated');
    },
    onError: () => toast.error('Failed to update call to action'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.CampaignCta.update(id, { is_active: false }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['campaign_ctas'] });
      setSelectedIds(prev => prev.filter(x => x !== id));
      setEditingId(null);
      toast.success('Call to action deactivated');
    },
    onError: () => toast.error('Failed to deactivate call to action'),
  });

  const toggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ label: c.label, url: c.url, guidance: c.guidance || '' });
  };

  const canCreate = newCta.label.trim() !== '' && newCta.url.trim() !== '';

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div>
        <Label className="text-sm font-medium text-gray-700">Calls to Action</Label>
        <p className="text-xs text-gray-500 mt-0.5">
          Pick the CTAs Maya should weave into this campaign's drafts. At most two are used per email.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : ctas.length === 0 ? (
        <p className="text-xs text-gray-400">No saved calls to action yet — add your first below.</p>
      ) : (
        <div className="space-y-1">
          {ctas.map(c => (
            <div key={c.id}>
              {editingId === c.id ? (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5 space-y-2">
                  <Input
                    placeholder="Label (e.g. Book a Demo Call)"
                    value={editForm.label}
                    onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                    className="text-sm h-8"
                  />
                  <Input
                    placeholder="URL"
                    value={editForm.url}
                    onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                    className="text-sm h-8"
                  />
                  <Input
                    placeholder="Guidance (optional)"
                    value={editForm.guidance}
                    onChange={e => setEditForm(f => ({ ...f, guidance: e.target.value }))}
                    className="text-sm h-8"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => editMutation.mutate({
                        id: c.id,
                        data: {
                          label: editForm.label.trim(),
                          url: editForm.url.trim(),
                          guidance: editForm.guidance.trim() || undefined,
                        },
                      })}
                      disabled={!editForm.label.trim() || !editForm.url.trim() || editMutation.isPending}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 ml-auto"
                      onClick={() => deactivateMutation.mutate(c.id)}
                      disabled={deactivateMutation.isPending}
                    >
                      Deactivate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                  <Switch
                    checked={selectedIds.includes(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.label}</p>
                    <p className="text-xs text-gray-400 truncate">{c.url}</p>
                    {c.guidance && <p className="text-[11px] text-gray-400 italic truncate">{c.guidance}</p>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-6 h-6 text-gray-300 hover:text-gray-600 shrink-0"
                    onClick={() => startEdit(c)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new CTA */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs font-medium text-gray-600">Add new call to action</p>
        <Input
          placeholder="Label (e.g. Book a Demo Call)"
          value={newCta.label}
          onChange={e => setNewCta(f => ({ ...f, label: e.target.value }))}
          className="text-sm h-8"
        />
        <Input
          placeholder="URL (https://…)"
          value={newCta.url}
          onChange={e => setNewCta(f => ({ ...f, url: e.target.value }))}
          className="text-sm h-8"
        />
        <Input
          placeholder="Guidance (optional — e.g. primary CTA for warm partner leads)"
          value={newCta.guidance}
          onChange={e => setNewCta(f => ({ ...f, guidance: e.target.value }))}
          className="text-sm h-8"
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => createMutation.mutate()}
          disabled={!canCreate || createMutation.isPending}
        >
          <Plus className="w-3.5 h-3.5" /> Add & enable
        </Button>
      </div>
    </div>
  );
}