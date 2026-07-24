import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Mail, Phone, User, Star, ExternalLink, FileText, Plus, Trash2, CheckCircle, Clock, DollarSign, ChevronDown, Pencil, Wand2, UserPlus, Linkedin } from 'lucide-react';
import ConvertReferralToClientDialog from '@/components/referrals/ConvertReferralToClientDialog';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagSelector } from '@/components/ui/TagSelector';
import TagManager from '@/components/ui/TagManager';
import { toast } from 'sonner';
import MayaInsightsWidget from '@/components/shared/MayaInsightsWidget';
import RecordSnapshotHeader from '@/components/shared/RecordSnapshotHeader';
import CollapsibleFieldSection from '@/components/shared/CollapsibleFieldSection';
import { InlineText } from '@/components/shared/inline/InlineText';
import { InlineSelect } from '@/components/shared/inline/InlineSelect';
import { LEAD_STAGES } from '@/components/shared/constants';
import { LEAD_STATUS_CONFIG as STATUS_CONFIG, PARTNER_STATUS_CONFIG, REFERRAL_STATUS_COLORS, PROPOSAL_STATUS_CONFIG } from '@/lib/statusConfig';
import InteractionTimeline from '@/components/shared/InteractionTimeline';
import { setMayaRecordContext, clearMayaRecordContext } from '@/lib/mayaOrbStore';

const EMPTY_REFERRAL = { date: '', company_name: '', contact_name: '', notes: '', client_id: '', proposal_id: '', partner_id: '' };
const EMPTY_PROPOSAL_FORM = { referralId: '', proposalId: '' };

// Calculate adjusted revenue: wellness box items count at 50%
function calcAdjustedRevenue(proposal) {
  if (!proposal) return 0;
  const s = proposal.selections || {};
  const overrides = s.priceOverrides || {};
  const customCharges = s.customCharges || [];
  const BOX_PRICES = {
    reduceStress: 60, relaxationSleep: 60, largeEmotional: 100,
    largeStressReduction: 120, stressReductionDigital: 50,
    beyondBurnoutDigital: 100, emotionalWellness: 100,
    wintertimeHealthy: 100, newYearFreshStart: 100
  };
  let nonBoxTotal = 0;
  const challengePrice = s.challengePrice || 0;
  (s.workshops || []).forEach(id => nonBoxTotal += (overrides[id] ?? 0));
  (s.challengePrograms || []).forEach(id => nonBoxTotal += (overrides[id] ?? challengePrice));
  (s.leadership || []).forEach(id => nonBoxTotal += (overrides[id] ?? 0));
  (s.movementClasses || []).forEach(id => nonBoxTotal += (overrides[id] ?? 0));
  customCharges.forEach(c => nonBoxTotal += (c.amount || 0));
  let boxTotal = 0;
  const boxQtys = s.sampleBoxQuantities || {};
  Object.entries(boxQtys).forEach(([key, qty]) => { boxTotal += (qty || 0) * (BOX_PRICES[key] || 0); });
  const customBoxQty = s.customBoxQuantity || 0;
  const customBoxItems = s.customBoxItems || [];
  if (customBoxQty > 0 && customBoxItems.length > 0) {
    const unitPrice = customBoxItems.reduce((sum, item) => sum + (item.price || 0), 0);
    boxTotal += customBoxQty * unitPrice;
  }
  const adjusted = nonBoxTotal + boxTotal * 0.5;
  return adjusted > 0 ? adjusted : proposal.total_amount || 0;
}

export default function BrokerLeadDetail({ lead: initialLead, onClose, onUpdate }) {
  const navigate = useNavigate();
  const { data: lead = initialLead } = useQuery({
    queryKey: ['lead', initialLead.id],
    queryFn: async () => {
      const leads = await base44.entities.Lead.filter({ id: initialLead.id });
      return leads[0] || initialLead;
    },
    initialData: initialLead
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddReferral, setShowAddReferral] = useState(false);
  const [referralForm, setReferralForm] = useState(EMPTY_REFERRAL);
  const [showAddProposal, setShowAddProposal] = useState(false);
  const [convertingReferral, setConvertingReferral] = useState(null);
  const [proposalForm, setProposalForm] = useState(EMPTY_PROPOSAL_FORM);

  useEffect(() => {
    if (lead?.id && lead?.name) {
      setMayaRecordContext({ recordType: 'lead', recordId: lead.id, recordName: lead.name });
    }
    return () => clearMayaRecordContext();
  }, [lead?.id, lead?.name]);

  const queryClient = useQueryClient();

  const updateLeadMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.update(lead.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', initialLead.id] });
      if (onUpdate) onUpdate();
    }
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: allProposals = [] } = useQuery({
    queryKey: ['allProposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date')
  });

  const { data: allPartners = [] } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.list()
  });

  const { data: allReferrals = [] } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => base44.entities.Referral.list()
  });

  // Match ReferralPartner portal record for this lead
  const matchedPartner = allPartners.find(p =>
    p.email?.toLowerCase() === lead.email?.toLowerCase() ||
    p.name?.toLowerCase() === lead.name?.toLowerCase()
  );

  // All Referral entity records for this partner
  const partnerReferrals = matchedPartner
    ? allReferrals.filter(r => r.referral_partner_id === matchedPartner.id)
    : [];

  const referralTotalValue = partnerReferrals.reduce((sum, r) => sum + (r.first_year_revenue || 0), 0);

  // Proposals linked via Referral.invoice_id
  const partnerProposalIds = new Set(partnerReferrals.map(r => r.invoice_id).filter(Boolean));
  const partnerProposals = allProposals.filter(p => partnerProposalIds.has(p.id));
  const partnerAcceptedValue = partnerProposals
    .filter(p => p.status === 'accepted')
    .reduce((sum, p) => sum + (p.total_amount || 0), 0);

  // Display stats
  const displayReferrals = partnerReferrals.length;
  const displayProposalCount = partnerProposals.length;
  const displayTotalValue = referralTotalValue;

  const statusCfg = STATUS_CONFIG[lead.status || 'cold'] || STATUS_CONFIG.cold;
  const partnerCfg = PARTNER_STATUS_CONFIG[lead.partner_status || 'new'] || PARTNER_STATUS_CONFIG.new;
  const isActive = lead.partner_status === 'active_partner';
  const sourceParts = (lead.source || '').split(' | ');
  const linkedinUrl = lead.linkedin_url || sourceParts[1] || '';

  const daysSince = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    if (diff < 30) return `${diff} days ago`;
    if (diff < 60) return '1 month ago';
    return `${Math.floor(diff / 30)} months ago`;
  };

  const handleFieldUpdate = async (updates) => {
    queryClient.setQueryData(['lead', initialLead.id], old => old ? { ...old, ...updates } : old);

    try {
      await updateLeadMutation.mutateAsync(updates);
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['lead', initialLead.id] });
      throw e;
    }

    const sheetName = lead.sheet_origin?.replace('BrokerLeads:', '') || 'Referral Partners';
    if ('status' in updates) {
      base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updatePipelineStage',
        leadId: lead.id,
        email: lead.email,
        sheetRowId: lead.sheet_row_id,
        sheetName,
        status: updates.status || 'cold',
      }).catch(e => console.warn('Sheet pipeline stage sync failed:', e));
    }
    if ('owner' in updates) {
      base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updateOwner',
        leadId: lead.id,
        email: lead.email,
        sheetRowId: lead.sheet_row_id,
        sheetName,
        owner: updates.owner || '',
      }).catch(e => console.warn('Sheet owner sync failed:', e));
    }
    if ('tags' in updates) {
      base44.functions.invoke('syncBrokerLeadsSheet', {
        action: 'updateTags',
        leadId: lead.id,
        email: lead.email,
        sheetName,
        tags: updates.tags,
      }).catch(e => console.warn('Sheet tag sync failed:', e));
    }
  };

  const toggleActivePartner = async () => {
    if (isActive) {
      // Demote back to nurturing
      updateLeadMutation.mutate({ partner_status: 'nurturing' });
      toast.success('Moved back to Nurturing');
      return;
    }

    // Promote to Active Partner
    updateLeadMutation.mutate({ partner_status: 'active_partner' });

    // Create or activate a ReferralPartner record so the portal gets provisioned
    const DEFAULT_TIERS = [
      { label: 'Introducing Partner', min_revenue: 0, max_revenue: 74999, rate: 0.10 },
      { label: 'Active Partner', min_revenue: 75000, max_revenue: 149999, rate: 0.125 },
      { label: 'Strategic Partner', min_revenue: 150000, max_revenue: null, rate: 0.15 },
    ];

    if (matchedPartner) {
      // Partner record exists but may not be active — activate it so the automation fires
      if (!matchedPartner.is_active) {
        await base44.entities.ReferralPartner.update(matchedPartner.id, { is_active: true });
      }
      // If they already have a portal, nothing more to do
      if (!matchedPartner.unique_portal_id) {
        // Trigger the automation by setting is_active (already handled above if it was inactive)
        // If it was already active but missing portal, do a no-op update to trigger automation
        await base44.entities.ReferralPartner.update(matchedPartner.id, { is_active: true });
      }
    } else {
      // No ReferralPartner record exists — create one with a portal ID
      const portalId = crypto.randomUUID();
      await base44.entities.ReferralPartner.create({
        name: lead.name,
        email: lead.email,
        company: lead.company || '',
        phone: lead.phone || '',
        is_active: true,
        unique_portal_id: portalId,
        commission_tiers: DEFAULT_TIERS,
        partner_status: 'Active Partner',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
    toast.success('Marked as Active Partner — portal provisioning in progress!');
  };

  // Add a new Referral entity record (and update lead history)
  const addReferral = async () => {
    if (!referralForm.date || !referralForm.company_name) return;

    const partnerId = referralForm.partner_id || matchedPartner?.id;
    const partner = allPartners.find(p => p.id === partnerId);
    if (!partner) {
      toast.error('No matching Referral Partner portal found for this lead.');
      return;
    }

    const linkedProposal = referralForm.proposal_id
      ? allProposals.find(p => p.id === referralForm.proposal_id)
      : null;
    const firstYearRevenue = calcAdjustedRevenue(linkedProposal);
    const ytdRevenue = (partner.ytd_revenue || 0) + firstYearRevenue;
    const tiers = partner.commission_tiers || [];
    const tier = tiers.filter(t => ytdRevenue >= (t.min_revenue || 0)).sort((a, b) => b.min_revenue - a.min_revenue)[0] || null;
    const commissionRate = tier?.rate || 0;

    await base44.entities.Referral.create({
      referral_partner_id: partner.id,
      referral_partner_name: partner.name,
      contact_name: referralForm.contact_name || '',
      company_name: referralForm.company_name,
      notes: referralForm.notes || '',
      referral_date: new Date(referralForm.date).toISOString(),
      status: linkedProposal ? 'purchased' : 'submitted',
      referred_client_id: referralForm.client_id || '',
      invoice_id: referralForm.proposal_id || '',
      first_year_revenue: firstYearRevenue,
      commission_rate: commissionRate,
      commission_amount: firstYearRevenue * commissionRate
    });

    if (firstYearRevenue > 0) {
      await base44.entities.ReferralPartner.update(partner.id, { ytd_revenue: ytdRevenue });
    }

    // Update lead history + partner_status
    const updatedHistory = [...(lead.referral_history || []), {
      date: referralForm.date,
      company_name: referralForm.company_name,
      contact_name: referralForm.contact_name,
      notes: referralForm.notes
    }];
    updateLeadMutation.mutate({
      referral_history: updatedHistory,
      referral_count: updatedHistory.length,
      last_referral_date: referralForm.date,
      partner_status: 'active_partner'
    });

    setReferralForm(EMPTY_REFERRAL);
    setShowAddReferral(false);
    queryClient.invalidateQueries({ queryKey: ['referrals'] });
    queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
    toast.success('Referral added!');
  };

  const deleteReferralRecord = async (referral) => {
    if (!confirm(`Delete referral for ${referral.company_name}? This cannot be undone.`)) return;
    await base44.entities.Referral.delete(referral.id);
    queryClient.invalidateQueries({ queryKey: ['referrals'] });
    toast.success('Referral deleted');
  };

  // Link an accepted proposal to an existing referral record
  const linkProposalMutation = useMutation({
    mutationFn: ({ referralId, proposalId }) =>
      base44.functions.invoke('recordReferralPurchase', {
        referral_id: referralId,
        proposal_id: proposalId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allProposals'] });
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setShowAddProposal(false);
      setProposalForm(EMPTY_PROPOSAL_FORM);
      toast.success('Proposal linked — referral marked as purchased!');
      if (onUpdate) onUpdate();
    }
  });

  // Referrals that don't yet have a proposal linked
  const unlinkedReferrals = partnerReferrals.filter(r => !r.invoice_id);

  // Accepted proposals available to link to the selected referral
  const selectedRef = unlinkedReferrals.find(r => r.id === proposalForm.referralId);
  const refCompany = (selectedRef?.company_name || '').toLowerCase();
  const candidateProposals = selectedRef ? allProposals.filter(p => {
    if (partnerProposalIds.has(p.id)) return false;
    // Only show accepted proposals
    if (p.status !== 'accepted') return false;
    // Match by linked client ID first
    if (selectedRef.referred_client_id && p.client_id === selectedRef.referred_client_id) return true;
    // Fallback: fuzzy match by company name
    if (!refCompany) return true;
    const c = allClients.find(cl => cl.id === p.client_id);
    const clientCompany = (c?.company || c?.name || p.client_name || '').toLowerCase();
    return clientCompany.includes(refCompany) || refCompany.includes(clientCompany);
  }) : [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="sr-only">{lead.name}</DialogTitle>
          <RecordSnapshotHeader record={lead} entityType="Lead" stages={LEAD_STAGES} onUpdate={handleFieldUpdate} />
          <div className="flex justify-end gap-2 mt-2 flex-wrap">
            {(lead.lead_type === 'company_inquiry' || (lead.quickbuilder_selections?.length || 0) > 0) && (
              <Button
                onClick={() => navigate(`/CurriculumDesigner?leadId=${lead.id}${lead.matched_stage ? `&stage=${encodeURIComponent(lead.matched_stage)}` : ''}`)}
                className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-1.5"
                size="sm"
              >
                <Wand2 className="w-4 h-4" />
                Open in Curriculum Designer
              </Button>
            )}
            <Button
              onClick={toggleActivePartner}
              disabled={updateLeadMutation.isPending}
              className={isActive
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-white border-2 border-green-600 text-green-700 hover:bg-green-50'}
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              {isActive ? 'Active Partner ✓' : 'Promote to Active Partner'}
            </Button>
          </div>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50 border-b flex-shrink-0">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#013f7c]">{displayReferrals}</p>
            <p className="text-xs text-gray-500 mt-0.5">Referrals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{displayProposalCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Proposals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">${displayTotalValue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Value</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="w-full rounded-none border-b bg-white px-6 justify-start h-10 gap-1">
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="referrals" className="text-sm">
                Referrals ({displayReferrals})
              </TabsTrigger>
              <TabsTrigger value="proposals" className="text-sm">
                Proposals ({displayProposalCount})
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-sm">Activity</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="p-6 space-y-2 mt-0">
              <CollapsibleFieldSection title="Contact" icon={User} defaultOpen>
                <InlineText label="Title" value={lead.title} onSave={v => handleFieldUpdate({ title: v })} />
                <InlineText label="Email" value={lead.email} onSave={v => handleFieldUpdate({ email: v })} />
                <InlineText label="Phone" value={lead.phone} onSave={v => handleFieldUpdate({ phone: v })} />
                <InlineText label="Industry" value={lead.industry} onSave={v => handleFieldUpdate({ industry: v })} />
                <div className="sm:col-span-2">
                  <InlineText label="LinkedIn URL" value={lead.linkedin_url} onSave={v => handleFieldUpdate({ linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
                </div>
                {linkedinUrl && (
                  <div className="sm:col-span-2">
                    <a href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#0a66c2] hover:underline">
                      <Linkedin className="w-4 h-4" />LinkedIn
                    </a>
                  </div>
                )}
              </CollapsibleFieldSection>

              <CollapsibleFieldSection title="Partner Details" icon={Star}>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Partner Status</span>
                  <InlineSelect
                    label="Partner Status"
                    value={lead.partner_status}
                    onSave={v => handleFieldUpdate({ partner_status: v })}
                    options={[
                      { value: 'new', label: 'New Lead' },
                      { value: 'nurturing', label: 'Nurturing' },
                      { value: 'active_partner', label: 'Active Partner' },
                      { value: 'inactive', label: 'Inactive' },
                    ]}
                  />
                </div>
                {lead.last_contacted_date && (
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-gray-400">Last Contacted</span>
                    <span className="text-sm text-gray-700">{new Date(lead.last_contacted_date).toLocaleDateString()}</span>
                  </div>
                )}
                {lead.last_referral_date && (
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-gray-400">Last Referral</span>
                    <span className="text-sm text-gray-700">{new Date(lead.last_referral_date).toLocaleDateString()}</span>
                  </div>
                )}
              </CollapsibleFieldSection>

              <CollapsibleFieldSection title="Notes" icon={FileText}>
                <div className="sm:col-span-2">
                  <InlineText value={lead.notes} onSave={v => handleFieldUpdate({ notes: v })} multiline placeholder="Add notes..." />
                </div>
              </CollapsibleFieldSection>

              <MayaInsightsWidget recordType="partner" recordId={lead.id} owner={lead.owner} />
            </TabsContent>

            {/* Referrals (merged with Companies) */}
            <TabsContent value="referrals" className="p-6 mt-0">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700">Client Referrals</h4>
                <Button size="sm" variant="outline" onClick={() => {
                  setReferralForm({ ...EMPTY_REFERRAL, partner_id: matchedPartner?.id || '' });
                  setShowAddReferral(!showAddReferral);
                }} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Referral
                </Button>
              </div>

              {showAddReferral && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
                  <h5 className="text-sm font-semibold text-blue-800">Log a Referral</h5>
                  {!matchedPartner && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Referral Partner Portal *</label>
                      <Select
                        value={referralForm.partner_id}
                        onValueChange={val => setReferralForm({ ...referralForm, partner_id: val })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select partner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allPartners.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date *</label>
                      <Input type="date" value={referralForm.date} onChange={e => setReferralForm({ ...referralForm, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Company Name *</label>
                      <Input placeholder="Company referred" value={referralForm.company_name} onChange={e => setReferralForm({ ...referralForm, company_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Contact Name</label>
                      <Input placeholder="Contact at company" value={referralForm.contact_name} onChange={e => setReferralForm({ ...referralForm, contact_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Linked Client (optional)</label>
                      <Select
                        value={referralForm.client_id}
                        onValueChange={val => {
                          const client = allClients.find(c => c.id === val);
                          setReferralForm({ ...referralForm, client_id: val, company_name: client?.company || client?.name || referralForm.company_name, proposal_id: '' });
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allClients.filter(c => c.company || c.name).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea placeholder="Notes (optional)" rows={2} value={referralForm.notes} onChange={e => setReferralForm({ ...referralForm, notes: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#013f7c] hover:bg-[#012d5a]" onClick={addReferral} disabled={!referralForm.date || !referralForm.company_name}>
                      Save Referral
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddReferral(false); setReferralForm(EMPTY_REFERRAL); }}>Cancel</Button>
                  </div>
                </div>
              )}

              {partnerReferrals.length === 0 && !showAddReferral ? (
                <div className="text-center py-10 text-gray-400">
                  <Building className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p>No referrals logged yet.</p>
                  <p className="text-xs mt-1">Click "Add Referral" to record one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {partnerReferrals
                    .slice()
                    .sort((a, b) => new Date(b.referral_date) - new Date(a.referral_date))
                    .map(ref => {
                      const linkedProposal = ref.invoice_id ? allProposals.find(p => p.id === ref.invoice_id) : null;
                      return (
                        <div key={ref.id} className="bg-white border rounded-lg p-4 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-800">{ref.company_name}</p>
                              {ref.contact_name && <span className="text-sm text-gray-500">— {ref.contact_name}</span>}
                              <Badge className={`text-xs ${REFERRAL_STATUS_COLORS[ref.status] || 'bg-gray-100 text-gray-600'}`}>
                                {ref.status?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(ref.referral_date).toLocaleDateString()} · {daysSince(ref.referral_date)}
                            </p>
                            {linkedProposal && (
                              <p className="text-xs text-green-700 font-medium mt-1 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${linkedProposal.total_amount?.toLocaleString()} proposal linked
                                {ref.commission_amount > 0 && <span className="text-gray-400 ml-1">· ${ref.commission_amount.toLocaleString()} commission</span>}
                              </p>
                            )}
                            {ref.notes && <p className="text-xs text-gray-400 mt-1 italic">{ref.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-[#264d44] border-[#264d44] hover:bg-[#264d44] hover:text-white" onClick={() => setConvertingReferral(ref)}>
                              <UserPlus className="w-3.5 h-3.5" /> Convert
                            </Button>
                            <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600 h-7 w-7" onClick={() => deleteReferralRecord(ref)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>

            {/* Proposals */}
            <TabsContent value="proposals" className="p-6 mt-0">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-gray-700">Accepted Proposals</h4>
                {matchedPartner && unlinkedReferrals.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                    setProposalForm(EMPTY_PROPOSAL_FORM);
                    setShowAddProposal(!showAddProposal);
                  }}>
                    <Plus className="w-3.5 h-3.5" /> Add Proposal
                  </Button>
                )}
              </div>

              {showAddProposal && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 mb-4">
                  <h5 className="text-sm font-semibold text-blue-800">Link an Accepted Proposal</h5>

                  {/* Step 1: pick the referred company */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Select Referral Company *</label>
                    <Select value={proposalForm.referralId} onValueChange={val => {
                      setProposalForm({ referralId: val, proposalId: '' });
                    }}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Choose a referred company..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unlinkedReferrals.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.company_name || r.contact_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: pick a proposal for that company — only shown after company selected */}
                  {proposalForm.referralId && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Select Accepted Proposal *</label>
                      {candidateProposals.length === 0 ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                          No proposals found for this company. Make sure a proposal exists for this client in the system.
                        </p>
                      ) : (
                        <Select value={proposalForm.proposalId} onValueChange={val => setProposalForm(f => ({ ...f, proposalId: val }))}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Choose a proposal..." />
                          </SelectTrigger>
                          <SelectContent>
                            {candidateProposals.map(p => {
                              const c = allClients.find(cl => cl.id === p.client_id);
                              const companyLabel = c?.company || c?.name || p.client_name || 'Unknown';
                              const statusLabel = (p.status || 'draft').charAt(0).toUpperCase() + (p.status || 'draft').slice(1);
                              return (
                                <SelectItem key={p.id} value={p.id}>
                                  {companyLabel} — ${p.total_amount?.toLocaleString()} ({statusLabel}, {new Date(p.created_date).toLocaleDateString()})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#013f7c] hover:bg-[#012d5a]"
                      disabled={!proposalForm.referralId || !proposalForm.proposalId || linkProposalMutation.isPending}
                      onClick={() => linkProposalMutation.mutate({ referralId: proposalForm.referralId, proposalId: proposalForm.proposalId })}>
                      {linkProposalMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddProposal(false); setProposalForm(EMPTY_PROPOSAL_FORM); }}>Cancel</Button>
                  </div>
                </div>
              )}

              {partnerProposals.length === 0 && !showAddProposal ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>No proposals linked yet.</p>
                  {unlinkedReferrals.length > 0 && (
                    <p className="text-xs mt-1">Use "Add Proposal" to link an accepted proposal to a referral.</p>
                  )}
                  {unlinkedReferrals.length === 0 && partnerReferrals.length === 0 && (
                    <p className="text-xs mt-1">Add referrals first, then link proposals here.</p>
                  )}
                </div>
              ) : (
                <>
                  {partnerProposals.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Total Pipeline</p>
                        <p className="text-xl font-bold text-[#013f7c]">${partnerProposals.reduce((s, p) => s + (p.total_amount || 0), 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Won Value</p>
                        <p className="text-xl font-bold text-green-700">${partnerAcceptedValue.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {partnerProposals.map(proposal => {
                      const client = allClients.find(c => c.id === proposal.client_id);
                      const ref = partnerReferrals.find(r => r.invoice_id === proposal.id);
                      return (
                        <div key={proposal.id} className="bg-white border rounded-lg p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-800">${proposal.total_amount?.toLocaleString()}</p>
                              {ref && <p className="text-sm text-gray-600 font-medium">{ref.company_name}</p>}
                              {client && <p className="text-sm text-gray-500">{client.name}{client.company ? ` — ${client.company}` : ''}</p>}
                              {ref?.commission_amount > 0 && (
                                <p className="text-xs text-green-700 font-medium mt-0.5">
                                  Commission: ${ref.commission_amount.toLocaleString()} ({((ref.commission_rate || 0) * 100).toFixed(1)}%)
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">Created: {new Date(proposal.created_date).toLocaleDateString()}</p>
                            </div>
                            <Badge className={`text-xs ${PROPOSAL_STATUS_CONFIG[proposal.status || 'draft']?.color || 'bg-gray-100 text-gray-700'}`}>
                              {(proposal.status || 'draft').charAt(0).toUpperCase() + (proposal.status || 'draft').slice(1)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity" className="p-6 mt-0">
              <InteractionTimeline lead_id={lead.id} onUpdate={onUpdate} />
            </TabsContent>
          </Tabs>
        </div>

        {convertingReferral && (
          <ConvertReferralToClientDialog
            referral={convertingReferral}
            open={!!convertingReferral}
            onOpenChange={(o) => !o && setConvertingReferral(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['referrals'] });
              queryClient.invalidateQueries({ queryKey: ['clients'] });
              queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
              if (onUpdate) onUpdate();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}