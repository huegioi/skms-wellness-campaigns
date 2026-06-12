import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Copy, Check, Users, Mail, Phone, DollarSign, Link } from 'lucide-react';
import { toast } from 'sonner';

const generatePortalId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  default_rate: '',
  is_active: true,
  notes: ''
};

export default function Presenters() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPresenter, setEditingPresenter] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [copiedId, setCopiedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: presenters = [], isLoading } = useQuery({
    queryKey: ['presenters'],
    queryFn: () => base44.entities.Presenter.list('name')
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingPresenter) {
        return base44.entities.Presenter.update(editingPresenter.id, data);
      } else {
        return base44.entities.Presenter.create({
          ...data,
          unique_portal_id: generatePortalId()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presenters'] });
      toast.success(editingPresenter ? 'Presenter updated' : 'Presenter created');
      setDialogOpen(false);
    }
  });

  const openAdd = () => {
    setEditingPresenter(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (presenter) => {
    setEditingPresenter(presenter);
    setForm({
      name: presenter.name || '',
      email: presenter.email || '',
      phone: presenter.phone || '',
      default_rate: presenter.default_rate ?? '',
      is_active: presenter.is_active !== false,
      notes: presenter.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const data = {
      ...form,
      default_rate: form.default_rate !== '' ? Number(form.default_rate) : null
    };
    saveMutation.mutate(data);
  };

  const copyPortalLink = (presenter) => {
    const url = `${window.location.origin}/PresenterPortal?id=${presenter.unique_portal_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(presenter.id);
    toast.success('Portal link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-7 h-7" style={{ color: '#013f7c' }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#013f7c' }}>Presenters</h1>
              <p className="text-sm text-gray-500">{presenters.length} presenter{presenters.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button onClick={openAdd} className="bg-[#013f7c] hover:bg-[#012d5a]">
            <Plus className="w-4 h-4 mr-2" />
            Add Presenter
          </Button>
        </div>

        {/* List */}
        {presenters.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No presenters yet</p>
            <p className="text-gray-400 text-sm mt-1">Add your first presenter to get started</p>
            <Button onClick={openAdd} className="mt-4 bg-[#013f7c] hover:bg-[#012d5a]">
              <Plus className="w-4 h-4 mr-2" />
              Add Presenter
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {presenters.map(presenter => (
              <Card key={presenter.id} className="p-5 bg-white hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{presenter.name}</h3>
                      <Badge className={presenter.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {presenter.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      {presenter.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {presenter.email}
                        </span>
                      )}
                      {presenter.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {presenter.phone}
                        </span>
                      )}
                      {presenter.default_rate && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${presenter.default_rate}/session
                        </span>
                      )}
                    </div>
                    {presenter.notes && (
                      <p className="text-sm text-gray-400 mt-1 truncate">{presenter.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPortalLink(presenter)}
                      className="gap-1.5"
                    >
                      {copiedId === presenter.id ? (
                        <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</>
                      ) : (
                        <><Link className="w-3.5 h-3.5" /> Portal Link</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(presenter)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPresenter ? 'Edit Presenter' : 'Add Presenter'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Default Rate ($/session)</Label>
              <Input
                type="number"
                value={form.default_rate}
                onChange={e => setForm(f => ({ ...f, default_rate: e.target.value }))}
                placeholder="e.g. 500"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 accent-[#013f7c]"
              />
              <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Internal notes..."
                rows={3}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-[#013f7c] hover:bg-[#012d5a]"
            >
              {saveMutation.isPending ? 'Saving...' : (editingPresenter ? 'Save Changes' : 'Add Presenter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}