import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const CATEGORIES = ['Awareness Month', 'HR Event', 'Broker Event', 'Internal SKMS Event'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const CATEGORY_COLORS = {
  'Awareness Month': 'bg-purple-100 text-purple-700 border-purple-200',
  'HR Event': 'bg-blue-100 text-blue-700 border-blue-200',
  'Broker Event': 'bg-amber-100 text-amber-700 border-amber-200',
  'Internal SKMS Event': 'bg-green-100 text-green-700 border-green-200',
};

const EMPTY_FORM = { name: '', category: '', target_month: '', prep_trigger_days: 45, is_active: true, notes: '' };

function CampaignForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.target_month) {
      toast.error('Please fill in Name, Category, and Month.');
      return;
    }
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
        <Input
          placeholder="e.g., Mental Health Awareness Month"
          value={form.name}
          onChange={e => set('name', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Category *</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Target Month *</label>
          <Select value={form.target_month} onValueChange={v => set('target_month', v)}>
            <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Prep Trigger (days in advance)</label>
        <Input
          type="number"
          min={1}
          value={form.prep_trigger_days}
          onChange={e => set('prep_trigger_days', Number(e.target.value))}
          className="w-32"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Notes (optional)</label>
        <Textarea
          rows={2}
          placeholder="Any additional context..."
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
        <span className="text-sm text-gray-600">Active</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving} className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white">
          {saving ? 'Saving...' : 'Save Campaign'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export default function CampaignCalendar() {
  const { user, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['annual_campaigns'],
    queryFn: () => base44.entities.AnnualCampaign.list('target_month'),
    enabled: !isLoadingAuth,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AnnualCampaign.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['annual_campaigns'] }); toast.success('Campaign added!'); setDialogOpen(false); },
    onError: () => toast.error('Failed to save campaign'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AnnualCampaign.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['annual_campaigns'] }); toast.success('Campaign updated!'); setEditing(null); setDialogOpen(false); },
    onError: () => toast.error('Failed to update campaign'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AnnualCampaign.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['annual_campaigns'] }); toast.success('Campaign removed'); },
    onError: () => toast.error('Failed to delete campaign'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.AnnualCampaign.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annual_campaigns'] }),
  });

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSave = (form) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (campaign) => { setEditing(campaign); setDialogOpen(true); };
  const openNew = () => { setEditing(null); setDialogOpen(true); };

  const saving = createMutation.isPending || updateMutation.isPending;

  // Group by month for the table
  const byMonth = MONTHS.map(month => ({
    month,
    items: campaigns.filter(c => c.target_month === month),
  })).filter(g => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#013f7c] flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Campaign Calendar</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Manage awareness months, events, and outreach triggers</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-[#013f7c] hover:bg-[#013f7c]/90 text-white gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New</span> Campaign
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {CATEGORIES.map(cat => {
          const count = campaigns.filter(c => c.category === cat && c.is_active).length;
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
              <p className="text-xs text-gray-500 mb-0.5 leading-tight">{cat}</p>
              <p className="text-xl font-bold text-gray-800">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No campaigns yet. Add your first one!</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Month</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Prep</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Active</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${!c.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3">
                      <Badge className={`border text-xs font-medium ${CATEGORY_COLORS[c.category] || 'bg-gray-100 text-gray-600'}`}>
                        {c.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.target_month}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{c.prep_trigger_days ?? 45}d</td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={!!c.is_active} onCheckedChange={v => toggleActiveMutation.mutate({ id: c.id, is_active: v })} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-[#013f7c]" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-red-500"
                          onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${!c.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{c.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.target_month} · {c.prep_trigger_days ?? 45} days prep</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-gray-400" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-gray-400"
                      onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className={`border text-xs font-medium ${CATEGORY_COLORS[c.category] || 'bg-gray-100 text-gray-600'}`}>
                    {c.category}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{c.is_active ? 'Active' : 'Inactive'}</span>
                    <Switch checked={!!c.is_active} onCheckedChange={v => toggleActiveMutation.mutate({ id: c.id, is_active: v })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
          </DialogHeader>
          <CampaignForm
            initial={editing || EMPTY_FORM}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}