import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Copy, ExternalLink, Users, DollarSign, Check, ChevronDown, ChevronUp, LayoutGrid, List, Mail, Settings, RefreshCw, Building2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import PartnerPipelineView from '@/components/partners/PartnerPipelineView';
import ReferralPartnerDetail from '@/components/partners/ReferralPartnerDetail';
import RecordCommissionPaymentDialog from '@/components/partners/RecordCommissionPaymentDialog';
import BrokerageDialog from '@/components/partners/BrokerageDialog';
import BrokerageRollup from '@/components/partners/BrokerageRollup';
import { LEAD_STAGES } from '@/components/shared/constants';
import { TagSelector } from '@/components/ui/TagSelector';
import TagFilter from '@/components/ui/TagFilter';
import TagManager from '@/components/ui/TagManager';
import { REFERRAL_STATUS_COLORS } from '@/lib/statusConfig';

const DEFAULT_TIERS = [
  { label: 'Introducing Partner', min_revenue: 0, max_revenue: 74999, rate: 0.10 },
  { label: 'Active Partner', min_revenue: 75000, max_revenue: 149999, rate: 0.125 },
  { label: 'Strategic Partner', min_revenue: 150000, max_revenue: null, rate: 0.15 },
];

const EMPTY_FORM = {
  name: '', email: '', email2: '', company: '', phone: '', address: '', notes: '',
  agreement_file_url: '', agreement_signed_date: '',
  commission_tiers: DEFAULT_TIERS, is_active: true, commissions_enabled: true, brokerage_id: null,
  follow_up_stage: '', linked_client_ids: [], tags: []
};

function generatePortalId() {
  return crypto.randomUUID();
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
  const [sendEmailConfirm, setSendEmailConfirm] = useState(null); // partner to confirm sending to
  const [viewingPartner, setViewingPartner] = useState(null);
  const [partnerTagFilter, setPartnerTagFilter] = useState([]);
  const [partnerTagMatchAll, setPartnerTagMatchAll] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null); // partner id currently sending
  const [regenerateConfirm, setRegenerateConfirm] = useState(null);
  const [regenerating, setRegenerating] = useState(null);
  const [paymentPartner, setPaymentPartner] = useState(null);
  const [showBrokerageDialog, setShowBrokerageDialog] = useState(false);
  const [editingBrokerage, setEditingBrokerage] = useState(null);
  const [expandedBrokerage, setExpandedBrokerage] = useState(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.list('-created_date')
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const partnerIdParam = searchParams.get('partnerId');

  useEffect(() => {
    if (partnerIdParam && partners.length > 0 && !viewingPartner) {
      const partner = partners.find(p => p.id === partnerIdParam);
      if (partner) {
        setViewingPartner(partner);
        searchParams.delete('partnerId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [partnerIdParam, partners, viewingPartner, setSearchParams, searchParams]);

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients_for_partners'],
    queryFn: () => base44.entities.Client.list('-created_date', 500)
  });

  const existingCompanies = useMemo(() => {
    const companies = partners.map(p => p.company).filter(Boolean);
    return [...new Set(companies)].sort();
  }, [partners]);

  const filteredPartners = partners.filter(p => {
    if (partnerTagFilter.length === 0) return true;
    return partnerTagMatchAll
      ? partnerTagFilter.every(t => p.tags?.includes(t))
      : partnerTagFilter.some(t => p.tags?.includes(t));
  });

  const { data: brokerages = [] } = useQuery({
    queryKey: ['brokerages'],
    queryFn: () => base44.entities.Brokerage.list('-created_date')
  });

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

      // For new partners: upsert a broker Lead and push to Google Sheet
      if (!editing && savedPartner?.id) {
        try {
          const emailKey = (data.email || '').toLowerCase();
          // Check if a matching broker Lead already exists for this email
          const allLeads = await base44.entities.Lead.filter({ lead_type: 'broker_lead', is_archived: { $ne: true } }, '-created_date', 500);
          let matchedLead = allLeads.find(l => l.email?.toLowerCase() === emailKey);

          if (!matchedLead) {
            matchedLead = await base44.entities.Lead.create({
              name: data.name,
              email: data.email,
              company: data.company || undefined,
              phone: data.phone || undefined,
              notes: data.notes || undefined,
              follow_up_stage: data.follow_up_stage || undefined,
              tags: data.tags || [],
              lead_type: 'broker_lead',
              partner_status: 'active_partner',
              status: 'cold',
            });
          }

          if (matchedLead?.id) {
            const appendRes = await base44.functions.invoke('syncBrokerLeadsSheet', {
              action: 'appendLead',
              name: data.name,
              email: data.email,
              company: data.company,
              phone: data.phone,
              notes: data.notes,
              follow_up_stage: data.follow_up_stage,
            });
            const { rowNumber, targetSheet } = appendRes.data || {};
            if (rowNumber) {
              await base44.entities.Lead.update(matchedLead.id, {
                sheet_row_id: String(rowNumber),
                sheet_origin: `BrokerLeads:${targetSheet || 'Referral Partners'}`,
              });
            }
          }
        } catch (e) {
          console.warn('Lead upsert / sheet append failed (non-critical):', e.message);
        }
      }

      return savedPartner;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referralPartners'] });
      qc.invalidateQueries({ queryKey: ['clients_for_partners'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
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

  const openNewBrokerage = () => {
    setEditingBrokerage(null);
    setShowBrokerageDialog(true);
  };

  const openEditBrokerage = (brokerage) => {
    setEditingBrokerage(brokerage);
    setShowBrokerageDialog(true);
  };

  const sendPortalEmail = async (partner) => {
    setSendingEmail(partner.id);
    setSendEmailConfirm(null);
    try {
      await base44.functions.invoke('provisionPartnerPortalOnActivation', {
        event: { type: 'manual' },
        data: { ...partner, unique_portal_id: partner.unique_portal_id },
        send_email: true,
      });
      toast({ title: 'Portal email sent!', description: `Sent to ${partner.email}` });
    } catch (e) {
      toast({ title: 'Failed to send email', description: e.message, variant: 'destructive' });
    } finally {
      setSendingEmail(null);
    }
  };

  const copyLink = (partner) => {
    const url = `${window.location.origin}/ReferralPortal?id=${partner.unique_portal_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regeneratePortalLink = async (partner) => {
    setRegenerating(partner.id);
    setRegenerateConfirm(null);
    try {
      const res = await base44.functions.invoke('regeneratePartnerPortalId', { partner_id: partner.id });
      const newUrl = `${window.location.origin}/ReferralPortal?id=${res.data.portal_id}`;
      navigator.clipboard.writeText(newUrl);
      setCopiedId(partner.id);
      setTimeout(() => setCopiedId(null), 3000);
      qc.invalidateQueries({ queryKey: ['referralPartners'] });
      toast({ title: 'Portal link regenerated', description: 'New link copied to clipboard.' });
    } catch (e) {
      toast({ title: 'Failed to regenerate link', description: e.message, variant: 'destructive' });
    } finally {
      setRegenerating(null);
    }
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
          <h1 className="text-2xl font-bold text-gray-800">{viewMode === 'brokerages' ? 'Brokerages' : 'Referral Partners'}</h1>
          <p className="text-gray-500 text-sm mt-1">{viewMode === 'brokerages' ? 'Manage brokerage groups and two-level commission structure' : 'Manage broker referral partners and their portal access'}</p>
          <Link to="/Leads" className="inline-flex items-center gap-1 text-sm text-[#013f7c] hover:underline mt-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Partner Pipeline
          </Link>
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
            <button
              onClick={() => setViewMode('brokerages')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'brokerages' ? 'bg-[#013f7c] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Building2 className="w-4 h-4" /> Brokerages
            </button>
          </div>
          <TagFilter
            selected={partnerTagFilter}
            onChange={setPartnerTagFilter}
            matchAll={partnerTagMatchAll}
            onMatchAllChange={setPartnerTagMatchAll}
          />
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setShowTagManager(true)}>
            <Settings className="w-4 h-4" /> Manage Tags
          </Button>
          {viewMode === 'brokerages' ? (
            <Button onClick={openNewBrokerage} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
              <Plus className="w-4 h-4" /> Add Brokerage
            </Button>
          ) : (
            <Button onClick={openNew} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
              <Plus className="w-4 h-4" /> Add Partner
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'brokerages' && (
        <div className="space-y-4">
          {brokerages.length === 0 && (
            <Card>
              <CardContent className="text-center py-16">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No brokerages yet. Add your first brokerage to manage a two-level commission structure.</p>
              </CardContent>
            </Card>
          )}
          {brokerages.map(b => {
            const brokerCount = partners.filter(p => p.brokerage_id === b.id && !p.is_demo).length;
            return (
              <Card key={b.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <button
                          onClick={() => setExpandedBrokerage(expandedBrokerage === b.id ? null : b.id)}
                          className="font-semibold text-gray-800 text-lg hover:text-[#013f7c] hover:underline transition-colors"
                        >
                          {b.name}
                        </button>
                        <Badge className={b.brokerage_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          House: {b.brokerage_commission_enabled !== false ? 'On' : 'Off'}
                        </Badge>
                        <Badge className={b.broker_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          Broker: {b.broker_commission_enabled !== false ? 'On' : 'Off'}
                        </Badge>
                      </div>
                      {b.company && <p className="text-gray-500 text-sm">{b.company}</p>}
                      <p className="text-gray-400 text-sm">{brokerCount} broker{brokerCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpandedBrokerage(expandedBrokerage === b.id ? null : b.id)}>
                        {expandedBrokerage === b.id ? 'Hide' : 'View'} Details
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditBrokerage(b)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                  {expandedBrokerage === b.id && <BrokerageRollup brokerage={b} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {viewMode === 'pipeline' && !isLoading && (
        <PartnerPipelineView partners={filteredPartners} referrals={referrals} onSelectPartner={setViewingPartner} />
      )}

      {viewMode === 'list' && isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {viewMode === 'list' && !isLoading && filteredPartners.length === 0 && (
        <Card>
          <CardContent className="text-center py-16">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No referral partners yet. Add your first partner to get started.</p>
          </CardContent>
        </Card>
      )}

      {viewMode === 'list' && !isLoading && filteredPartners.length > 0 && (
        <div className="space-y-4">
          {filteredPartners.map(partner => {
            const partnerReferrals = referrals.filter(r => r.referral_partner_id === partner.id && r.referral_partner_id);
            const totalCommission = partnerReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
            return (
              <Card key={partner.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => setViewingPartner(partner)}
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
                      {partner.unique_portal_id && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                            onClick={() => setSendEmailConfirm(partner)}
                            disabled={sendingEmail === partner.id}
                          >
                            <Mail className="w-4 h-4" />
                            {sendingEmail === partner.id ? 'Sending…' : 'Send Portal Email'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-orange-700 border-orange-200 hover:bg-orange-50"
                            onClick={() => setRegenerateConfirm(partner)}
                            disabled={regenerating === partner.id}
                          >
                            <RefreshCw className={`w-4 h-4 ${regenerating === partner.id ? 'animate-spin' : ''}`} />
                            {regenerating === partner.id ? 'Regenerating…' : 'Regenerate Link'}
                          </Button>
                        </>
                      )}

                      {partnerReferrals.some(r => r.status === 'purchased' && r.commission_amount > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => setPaymentPartner(partner)}
                        >
                          <DollarSign className="w-4 h-4" /> Record Payment
                        </Button>
                      )}
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
                          <Badge className={REFERRAL_STATUS_COLORS[r.status] || 'bg-blue-100 text-blue-700'}>
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

      {/* Send Email Confirmation Dialog */}
      <Dialog open={!!sendEmailConfirm} onOpenChange={v => { if (!v) setSendEmailConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Portal Access Email?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            This will send a portal access email to <strong>{sendEmailConfirm?.name}</strong> at <strong>{sendEmailConfirm?.email}</strong> with their private portal link.
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => sendPortalEmail(sendEmailConfirm)}
              className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2"
            >
              <Mail className="w-4 h-4" /> Yes, Send Email
            </Button>
            <Button variant="outline" onClick={() => setSendEmailConfirm(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Regenerate Portal Link Confirmation Dialog */}
      <Dialog open={!!regenerateConfirm} onOpenChange={v => { if (!v) setRegenerateConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate Portal Link?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            This will invalidate the partner's current portal link. Continue?
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={() => regeneratePortalLink(regenerateConfirm)}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Yes, Regenerate
            </Button>
            <Button variant="outline" onClick={() => setRegenerateConfirm(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Secondary Email</label>
                <Input type="email" value={form.email2 || ''} onChange={e => setForm(f => ({ ...f, email2: e.target.value }))} placeholder="Secondary email address" />
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
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Brokerage</label>
                <Select
                  value={form.brokerage_id || '__none__'}
                  onValueChange={(val) => setForm(f => ({ ...f, brokerage_id: val === '__none__' ? null : val }))}
                >
                  <SelectTrigger className="w-full bg-gray-50">
                    <SelectValue placeholder="None (solo partner)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-gray-400 italic">— None (solo partner) —</span>
                    </SelectItem>
                    {brokerages.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">When assigned, commission tiers come from the brokerage and are computed on aggregate revenue.</p>
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
              <label className="text-sm font-medium text-gray-700 block mb-1">Tags</label>
              <TagSelector value={form.tags || []} onChange={(tags) => setForm(f => ({ ...f, tags }))} />
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
                  <SelectItem value="__none__">
                    <span className="text-gray-400 italic">— No Stage —</span>
                  </SelectItem>
                  {LEAD_STAGES.map((stage, i) => (
                    <SelectItem key={i} value={stage.key}>{stage.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active Partner</label>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="commissions_enabled" checked={form.commissions_enabled !== false} onChange={e => setForm(f => ({ ...f, commissions_enabled: e.target.checked }))} className="rounded" />
              <label htmlFor="commissions_enabled" className="text-sm text-gray-700">Show commissions in portal</label>
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

      {/* Tag Manager Dialog */}
      <TagManager open={showTagManager} onOpenChange={setShowTagManager} />

      {/* Partner Detail Dialog */}
      {viewingPartner && (
        <ReferralPartnerDetail
          partner={viewingPartner}
          onClose={() => setViewingPartner(null)}
        />
      )}

      {/* Brokerage Dialog */}
      <BrokerageDialog
        open={showBrokerageDialog}
        onOpenChange={setShowBrokerageDialog}
        editing={editingBrokerage}
      />

      {/* Record Commission Payment Dialog */}
      {paymentPartner && (
        <RecordCommissionPaymentDialog
          partner={paymentPartner}
          open={!!paymentPartner}
          onOpenChange={(o) => !o && setPaymentPartner(null)}
        />
      )}
    </div>
  );
}