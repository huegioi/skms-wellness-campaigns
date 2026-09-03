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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Pencil, Check, Users, Mail, Phone, DollarSign, Link } from 'lucide-react';
import { toast } from 'sonner';
import PresenterPayouts from '@/components/presenter/PresenterPayouts';
import { useAuth } from '@/lib/AuthContext';

const generatePortalId = () => crypto.randomUUID();

// Twilio only accepts E.164. Type the number however you like; this is what gets texted.
// US-default — anything that isn't 10 digits, or 11 starting with 1, or already +… is
// left blank rather than guessing the wrong country.
export const toE164 = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) {
    const d = s.slice(1).replace(/\D/g, '');
    return d.length >= 8 && d.length <= 15 ? '+' + d : '';
  }
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.startsWith('1')) return '+' + d;
  return '';
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  sms_opt_in: false,
  default_rate: '',
  is_active: true,
  notes: ''
};

export default function Presenters() {
  const { user, isLoadingAuth } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPresenter, setEditingPresenter] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [copiedId, setCopiedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: presenters = [], isLoading } = useQuery({
    queryKey: ['presenters'],
    queryFn: () => base44.entities.Presenter.list('name'),
    enabled: !isLoadingAuth
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Derive the sendable number, and stamp consent the first time it's given — that
      // timestamp is the proof carriers require, so it is never cleared on re-save.
      const payload = { ...data, phone_e164: toE164(data.phone) };
      const hadConsent = editingPresenter?.sms_opt_in === true;
      if (payload.sms_opt_in && !hadConsent) {
        payload.sms_opt_in_at = new Date().toISOString();
        payload.sms_opt_out_at = null;
      }
      if (editingPresenter) {
        return base44.entities.Presenter.update(editingPresenter.id, payload);
      } else {
        return base44.entities.Presenter.create({
          ...payload,
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
      sms_opt_in: presenter.sms_opt_in === true,
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

  if (isLoadingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8 pb-24 md:pb-8">
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

        <Tabs defaultValue="roster">
          <TabsList className="mb-6">
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="payouts">
            <PresenterPayouts />
          </TabsContent>

          <TabsContent value="roster">
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
                  <Card key={presenter.id} className="p-4 bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900 text-base">{presenter.name}</h3>
                          <Badge className={presenter.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                            {presenter.is_active !== false ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-1 text-sm text-gray-500">
                          {presenter.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{presenter.email}</span>
                            </span>
                          )}
                          {presenter.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              {presenter.phone}
                            </span>
                          )}
                          {presenter.default_rate && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 shrink-0" />
                              ${presenter.default_rate}/session
                            </span>
                          )}
                        </div>
                        {presenter.notes && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-1">{presenter.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyPortalLink(presenter)}
                          className="gap-1.5 text-xs"
                        >
                          {copiedId === presenter.id ? (
                            <><Check className="w-3.5 h-3.5 text-green-600" /><span className="hidden sm:inline">Copied</span></>
                          ) : (
                            <><Link className="w-3.5 h-3.5" /><span className="hidden sm:inline">Portal Link</span></>
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
          </TabsContent>
        </Tabs>
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
                {form.phone && !toE164(form.phone) && (
                  <p className="text-xs text-amber-600 mt-1">
                    Not a number we can text — needs 10 digits, or start with + for non-US.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.sms_opt_in}
                  onChange={e => setForm(f => ({ ...f, sms_opt_in: e.target.checked }))}
                  disabled={!toE164(form.phone)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 disabled:opacity-40"
                />
                <span className="text-sm text-gray-700 leading-snug">
                  They agreed to receive texts about sessions
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {toE164(form.phone)
                      ? <>Texts go to <span className="font-mono">{toE164(form.phone)}</span>. Only tick this if they actually said yes — carriers require provable consent.</>
                      : 'Add a textable mobile number first.'}
                  </span>
                </span>
              </label>
              {editingPresenter?.sms_opt_out_at && (
                <p className="text-xs text-red-700 mt-2">
                  They replied STOP on {new Date(editingPresenter.sms_opt_out_at).toLocaleDateString()} — texting stays off until they reply START.
                </p>
              )}
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