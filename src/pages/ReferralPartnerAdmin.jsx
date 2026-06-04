import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, ExternalLink, Users, DollarSign, Check, ChevronDown, ChevronUp, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import PartnerPipelineView from '@/components/partners/PartnerPipelineView';

const DEFAULT_TIERS = [
  { label: 'Introducing Partner', min_revenue: 0, max_revenue: 74999, rate: 0.10 },
  { label: 'Active Partner', min_revenue: 75000, max_revenue: 149999, rate: 0.125 },
  { label: 'Strategic Partner', min_revenue: 150000, max_revenue: null, rate: 0.15 },
];

const FOLLOW_UP_STAGES = [
  '',
  'Day 1 - LinkedIn Connection',
  'Day 2 - Send email #1',
  'Day 3 - Call #1',
  'Day 3 - Text f/u to call',
  'Day 5 - Call #2',
  'Day 5 - LinkedIn f/u message',
  'Day 7 - Send email #2',
  'Day 10 - Call #3',
  'Day 10 - Send email #3',
  'Day 11 - LinkedIn message #3',
  'Day 15 - Send email #4',
  'Day 20 - Send email #5',
  'Referral Partner',
];

const EMPTY_FORM = {
  name: '', email: '', company: '', phone: '', address: '', notes: '',
  agreement_file_url: '', agreement_signed_date: '',
  commission_tiers: DEFAULT_TIERS, is_active: true,
  follow_up_stage: '', linked_client_ids: []
};

function generatePortalId() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

export default function ReferralPartnerAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [copiedId, setCopiedId] = useState(null);

  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [expandedPartner, setExpandedPartner] = useState(null);
  const [viewMode, setViewMode] = useState('pipeline');

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.list('-created_date')
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients_for_partners'],
    queryFn: () => base44.entities.Client.list('-created_date', 500)
  });

  const existingCompanies = useMemo(() => {
    const companies = partners.map(p => p.company).filter(Boolean);
    return [...new Set(companies)].sort();
  }, [partners]);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date')
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const { linked_client_ids, ...partnerData } = data;
      let savedPartner;
      if (editing) {
        savedPartner = await base44.entities.ReferralPartner.update(editing.id, partnerData);
      } else {
        savedPartner = await base44.entities.ReferralPartner.create({ ...partnerData, unique_portal_id: generatePortalId() });
      }
      const partnerId = editing ? editing.id : savedPartner.id;
      const partnerName = data.name;

      // Write referral_partner_id back to newly linked clients
      const currentlyLinked = allClients
        .filter(c => c.referral_partner_id === partnerId)
        .map(c => c.id);

      const toLink = (linked_client_ids || []).filter(id => !currentlyLinked.includes(id));
      const toUnlink = currentlyLinked.filter(id => !(linked_client_ids || []).includes(id));

      await Promise.all([
        ...toLink.map(id => base44.entities.Client.update(id, { referral_partner_id: partnerId, referral_partner_name: partnerName })),
        ...toUnlink.map(id => base44.entities.Client.update(id, { referral_partner_id: null, referral_partner_name: null })),
      ]);

      return savedPartner;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referralPartners'] });
      qc.invalidateQueries({ queryKey: ['clients_for_partners'] });
      setShowDialog(false);
      setEditing(null);
      toast({ title: editing ? 'Partner updated' : 'Partner created' });
    }
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (partner) => {
    setEditing(partner);
    const currentlyLinked = allClients
      .filter(c => c.referral_partner_id === partner.id)
      .map(c => c.id);
    setForm({
      name: partner.name || '',
      email: partner.email || '',
      company: partner.company || '',
      phone: partner.phone || '',
      address: partner.address || '',
      notes: partner.notes || '',
      agreement_file_url: partner.agreement_file_url || '',
      agreement_signed_date: partner.agreement_signed_date || '',
      commission_tiers: partner.commission_tiers?.length ? partner.commission_tiers : DEFAULT_TIERS,
      is_active: partner.is_active !== false,
      follow_up_stage: partner.follow_up_stage || '',
      linked_client_ids: currentlyLinked
    });
    setShowDialog(true);
  };

  const copyLink = (partner) => {
    const url = `${window.location.origin}/ReferralPortal?id=${partner.unique_portal_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateTier = (i, field, value) => {
    const tiers = [...form.commission_tiers];
    tiers[i] = { ...tiers[i], [field]: field === 'rate' ? parseFloat(value) || 0 : field.includes('revenue') ? (value === '' ? null : parseFloat(value)) : value };
    setForm(f => ({ ...f, commission_tiers: tiers }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Referral Partners</h1>
          <p className="text-gray-500 text-sm mt-1">Manage broker referral partners and their portal access</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'list' ? 'bg-[#013f7c] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'pipeline' ? 'bg-[#013f7c] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Pipeline
            </button>
          </div>
          <Button onClick={openNew} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
            <Plus className="w-4 h-4" /> Add Partner
          </Button>
        </div>
      </div>

      {viewMode === 'pipeline' && !isLoading && (
        <PartnerPipelineView partners={partners} referrals={referrals} />
      )}

      {viewMode === 'list' && isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {viewMode === 'list' && !isLoading && partners.length === 0 && (
        <Card>
          <CardContent className="text-center py-16">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No referral partners yet. Add your first partner to get started.</p>
          </CardContent>
        </Card>
      )}

      {viewMode === 'list' && !isLoading && partners.length > 0 && (
        <div className="space-y-4">
          {partners.map(partner => {
            const partnerReferrals = referrals.filter(r => r.referral_partner_id === partner.id && r.referral_partner_id);
            const totalCommission = partnerReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
            return (
              <Card key={partner.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => openEdit(partner)}
                          className="font-semibold text-gray-800 text-lg hover:text-[#013f7c] hover:underline transition-colors"
                        >
                          {partner.name}
                        </button>
                        <Badge className={partner.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {partner.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {partner.company && <p className="text-gray-500 text-sm">{partner.company}</p>}
                      <p className="text-gray-400 text-sm">{partner.email}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1 text-blue-700">
                          <Users className="w-4 h-4" />
                          {partnerReferrals.length} referral{partnerReferrals.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1 text-green-700">
                          <DollarSign className="w-4 h-4" />
                          ${totalCommission.toLocaleString()} earned
                        </span>
                        {partner.agreement_signed_date && (
                          <span className="text-gray-400">
                            Agreement signed {format(new Date(partner.agreement_signed_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => copyLink(partner)}
                      >
                        {copiedId === partner.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        {copiedId === partner.id ? 'Copied!' : 'Copy Link'}
                      </Button>
                      <a href={`/ReferralPortal?id=${partner.unique_portal_id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1">
                          <ExternalLink className="w-4 h-4" /> Portal
                        </Button>
                      </a>

                      {partnerReferrals.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setExpandedPartner(expandedPartner === partner.id ? null : partner.id)}>
                          {expandedPartner === partner.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {expandedPartner === partner.id ? 'Hide' : 'View'} Referrals
                        </Button>
                      )}
                    </div>
                  </div>
                  {expandedPartner === partner.id && (
                    <div className="mt-4 border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Referrals ({partnerReferrals.length})</p>
                      {partnerReferrals.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="font-medium text-gray-800">{r.contact_name}</span>
                            {r.company_name && <span className="text-gray-500 ml-1">— {r.company_name}</span>}
                            <span className="text-gray-400 ml-2 text-xs">{r.referral_date ? format(new Date(r.referral_date), 'MMM d, yyyy') : ''}</span>
                          </div>
                          <Badge className={
                            r.status === 'commission_paid' ? 'bg-purple-100 text-purple-700' :
                            r.status === 'purchased' ? 'bg-emerald-100 text-emerald-700' :
                            r.status === 'converted_to_client' ? 'bg-green-100 text-green-700' :
                            r.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {r.status?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Partner' : 'Add Referral Partner'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Email *</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 block mb-1">Company</label>
                <div className="flex gap-1">
                  <Input
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    placeholder="Type or select company"
                    onFocus={() => setCompanyDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCompanyDropdownOpen(false), 150)}
                  />
                  {existingCompanies.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onMouseDown={e => { e.preventDefault(); setCompanyDropdownOpen(o => !o); }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {companyDropdownOpen && existingCompanies.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {existingCompanies
                      .filter(c => !form.company || c.toLowerCase().includes(form.company.toLowerCase()))
                      .map(c => (
                        <button
                          key={c}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                          onMouseDown={() => { setForm(f => ({ ...f, company: c })); setCompanyDropdownOpen(false); }}
                        >
                          {c}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Address</label>
                <Input value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St, City, State ZIP" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Agreement File URL</label>
                <Input value={form.agreement_file_url} onChange={e => setForm(f => ({ ...f, agreement_file_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Agreement Signed Date</label>
                <Input type="date" value={form.agreement_signed_date} onChange={e => setForm(f => ({ ...f, agreement_signed_date: e.target.value }))} />
              </div>
            </div>

            {/* Commission Tiers */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Commission Tiers</label>
              <div className="space-y-2">
                {form.commission_tiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center p-3 bg-gray-50 rounded-lg">
                    <Input value={tier.label} onChange={e => updateTier(i, 'label', e.target.value)} placeholder="Label" className="text-sm" />
                    <Input type="number" value={tier.min_revenue} onChange={e => updateTier(i, 'min_revenue', e.target.value)} placeholder="Min $" className="text-sm" />
                    <Input type="number" value={tier.max_revenue ?? ''} onChange={e => updateTier(i, 'max_revenue', e.target.value)} placeholder="Max $ (blank=∞)" className="text-sm" />
                    <div className="flex items-center gap-1">
                      <Input type="number" step="0.001" min="0" max="1" value={tier.rate} onChange={e => updateTier(i, 'rate', e.target.value)} placeholder="Rate (0.125)" className="text-sm" />
                      <span className="text-gray-500 text-sm">{(tier.rate * 100 % 1 === 0 ? (tier.rate * 100).toFixed(0) : (tier.rate * 100).toFixed(1))}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Clients */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Linked Clients</label>
              <p className="text-xs text-gray-400 mb-2">Select clients referred by this partner. Their revenue will appear on the Commissions page.</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y bg-gray-50">
                {allClients.length === 0 && <p className="text-xs text-gray-400 p-3">No clients found.</p>}
                {allClients.map(c => {
                  const checked = (form.linked_client_ids || []).includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const ids = form.linked_client_ids || [];
                          setForm(f => ({
                            ...f,
                            linked_client_ids: e.target.checked
                              ? [...ids, c.id]
                              : ids.filter(id => id !== c.id)
                          }));
                        }}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-800">{c.company || c.name}</span>
                      {c.name && c.company && c.name !== c.company && (
                        <span className="text-xs text-gray-400">— {c.name}</span>
                      )}
                      {c.referral_partner_id && c.referral_partner_id !== (editing?.id) && (
                        <span className="text-xs text-orange-500 ml-auto">linked to another partner</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Follow-up Stage</label>
              <Select
                value={form.follow_up_stage || '__none__'}
                onValueChange={(val) => setForm(f => ({ ...f, follow_up_stage: val === '__none__' ? '' : val }))}
              >
                <SelectTrigger className="w-full bg-gray-50">
                  <SelectValue placeholder="Select follow-up stage" />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_STAGES.map((stage, i) => (
                    <SelectItem key={i} value={stage || '__none__'}>
                      {stage || <span className="text-gray-400 italic">— No Stage —</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active Partner</label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saveMutation.isPending} className="bg-[#013f7c] hover:bg-[#012d5a] text-white">
                {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Partner'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}