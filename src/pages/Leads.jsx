import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Building, Mail, Phone, Pencil, Trash2, RefreshCw, ExternalLink, User, Star, Users, ChevronDown, ChevronUp, AlertCircle, Handshake, Clock, ScanText, Share2, Copy, Edit, Check, Bell, List, Kanban, GitMerge, Settings } from 'lucide-react';
import GmailHistory from '@/components/clients/GmailHistory';
import BrokerLeadDetail from '@/components/leads/BrokerLeadDetail';
import PendingReferralsReview from '@/components/referrals/PendingReferralsReview';
import PipelineView from '@/components/leads/PipelineView';
import MergePartnerDuplicatesPanel from '@/components/leads/MergePartnerDuplicatesPanel';
import TagFilter from '@/components/ui/TagFilter';
import TagManager from '@/components/ui/TagManager';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea as TextareaUI } from '@/components/ui/textarea';
import { LEAD_STATUS_CONFIG as STATUS_CONFIG, PARTNER_STATUS_CONFIG, REFERRAL_STATUS_COLORS } from '@/lib/statusConfig';

const REFERRAL_POTENTIAL_CONFIG = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  high:   { label: 'High',   color: 'bg-green-100 text-green-700' },
};

const FOLLOW_UP_STAGES = [
  'Day 1: Initial Outreach',
  'Day 3: Follow-up #1',
  'Day 7: Follow-up #2',
  'Day 14: Follow-up #3',
  'Day 30: Follow-up #4',
  'Day 60: Follow-up #5',
  'Day 90: Final Follow-up',
  'Connected - Not Ready',
  'Not Interested',
];

// Unique colors for each follow-up stage
const STAGE_COLORS = {
  '': 'bg-gray-100 text-gray-700 border-gray-200',
  'Day 1 - LinkedIn Connection': 'bg-blue-50 text-blue-700 border-blue-200',
  'Day 2 - Send email #1': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Day 3 - Call #1': 'bg-purple-50 text-purple-700 border-purple-200',
  'Day 3 - Text f/u to call': 'bg-pink-50 text-pink-700 border-pink-200',
  'Day 5 - Call #2': 'bg-red-50 text-red-700 border-red-200',
  'Day 5 - LinkedIn f/u message': 'bg-orange-50 text-orange-700 border-orange-200',
  'Day 7 - Send email #2': 'bg-amber-50 text-amber-700 border-amber-200',
  'Day 10 - Call #3': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Day 10 - Send email #3': 'bg-lime-50 text-lime-700 border-lime-200',
  'Day 11 - LinkedIn message #3': 'bg-green-50 text-green-700 border-green-200',
  'Day 15 - Send email #4': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Day 20 - Send email #5': 'bg-teal-50 text-teal-700 border-teal-200',
  'Referral Partner': 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

function getStageColor(stage) {
  return STAGE_COLORS[stage] || 'bg-gray-100 text-gray-700 border-gray-200';
}

const EMPTY_BROKER_LEAD_FORM = {
  name: '', email: '', email2: '', company: '', title: '', phone: '',
  industry: '', status: 'cold', outreach_channel: 'email',
  last_contacted_date: '', next_followup_date: '', notes: '', source: '',
  lead_type: 'broker_lead', partner_status: 'new', follow_up_stage: '',
  referral_potential: 'medium', referral_count: 0, last_referral_date: ''
};

function PipelineStats({ leads, clientEmails, filterStatus, setFilterStatus, statusConfig, totalLabel }) {
  const counts = Object.keys(statusConfig).reduce((acc, key) => {
    acc[key] = leads.filter(l => {
      const eff = clientEmails.has(l.email?.toLowerCase()) ? 'current_client' : (l.status || 'cold');
      return eff === key;
    }).length;
    return acc;
  }, {});

  const pieData = Object.entries(statusConfig)
    .map(([key, cfg]) => ({ name: cfg.label, value: counts[key] || 0, key, color: cfg.chart }))
    .filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl shadow p-5 mb-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Pipeline Overview</h2>
      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="w-full md:w-64 h-52 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                {pieData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            counts[key] > 0 && (
              <button
                key={key}
                onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  filterStatus === key ? 'ring-2 ring-offset-1 ring-[#264d44] ' + cfg.color : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.chart }} />
                <span>{cfg.label}</span>
                <span className="bg-white border rounded-full px-1.5 py-0.5 text-xs font-bold text-gray-700">{counts[key]}</span>
              </button>
            )
          ))}
        </div>
        <div className="text-center flex-shrink-0">
          <p className="text-4xl font-bold text-[#013f7c]">{leads.length}</p>
          <p className="text-sm text-gray-500 mt-1">{totalLabel}</p>
        </div>
      </div>
    </div>
  );
}

function ActivePartnerTiles({ activePartners, onSelect }) {
  const daysSince = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1 day ago';
    if (diff < 30) return `${diff}d ago`;
    if (diff < 60) return '~1mo ago';
    return `${Math.floor(diff / 30)}mo ago`;
  };

  if (activePartners.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-green-600 fill-green-500" /> Active Referral Partners
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activePartners.map(lead => {
          const contactedDiff = lead.last_contacted_date
            ? Math.floor((new Date() - new Date(lead.last_contacted_date)) / (1000 * 60 * 60 * 24))
            : null;
          const urgencyColor = contactedDiff === null ? 'text-gray-400' : contactedDiff > 60 ? 'text-red-500' : contactedDiff > 30 ? 'text-amber-600' : 'text-green-600';
          const urgencyBg = contactedDiff === null ? 'bg-gray-50' : contactedDiff > 60 ? 'bg-red-50' : contactedDiff > 30 ? 'bg-amber-50' : 'bg-green-50';
          const recentReferrals = (lead.referral_history || [])
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 2);

          return (
            <button
              key={lead.id}
              onClick={() => onSelect(lead)}
              className="bg-white border-l-4 border-green-500 rounded-xl shadow-sm hover:shadow-md transition-all text-left p-4 group"
            >
              {/* Name + Company */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-gray-800 group-hover:text-[#013f7c] transition-colors">{lead.name}</p>
                  {lead.company && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Building className="w-3 h-3" />{lead.company}</p>}
                  {lead.title && <p className="text-xs text-gray-400">{lead.title}</p>}
                </div>
                <span className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-green-200">
                  Active
                </span>
              </div>

              {/* Email */}
              {lead.email && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-2 truncate">
                  <Mail className="w-3 h-3 flex-shrink-0" />{lead.email}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {(lead.referral_count || 0) > 0 && (
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                    {lead.referral_count} referral{lead.referral_count !== 1 ? 's' : ''}
                  </span>
                )}
                {lead.referral_potential && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    lead.referral_potential === 'high' ? 'bg-green-50 text-green-700' :
                    lead.referral_potential === 'medium' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {lead.referral_potential} potential
                  </span>
                )}
              </div>

              {/* Last contacted */}
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${urgencyBg} ${urgencyColor}`}>
                <Clock className="w-3 h-3 flex-shrink-0" />
                {lead.last_contacted_date
                  ? <>Last contact: {new Date(lead.last_contacted_date).toLocaleDateString()} <span className="opacity-70">({daysSince(lead.last_contacted_date)})</span></>
                  : 'No contact date recorded'}
              </div>

              {/* Recent referrals */}
              {recentReferrals.length > 0 && (
                <div className="mt-2 space-y-1">
                  {recentReferrals.map((ref, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-purple-50 border border-purple-100 rounded px-2 py-1">
                      <Star className="w-2.5 h-2.5 text-purple-400 fill-purple-300 flex-shrink-0" />
                      <span className="font-medium text-purple-800 truncate">{ref.company_name}</span>
                      <span className="ml-auto text-purple-400 flex-shrink-0">{daysSince(ref.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_TIERS = [
  { label: 'Introducing Partner', min_revenue: 0, max_revenue: 74999, rate: 0.10 },
  { label: 'Active Partner', min_revenue: 75000, max_revenue: 149999, rate: 0.125 },
  { label: 'Strategic Partner', min_revenue: 150000, max_revenue: null, rate: 0.15 },
];

const EMPTY_PARTNER_FORM = {
  name: '', email: '', company: '', phone: '', notes: '',
  agreement_file_url: '', agreement_signed_date: '',
  commission_tiers: DEFAULT_TIERS, is_active: true
};

function generatePortalId() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

export default function Leads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast: shadToast } = useToast();
  const [activeTab, setActiveTab] = useState('broker_leads');

  const leadIdFromUrl = new URLSearchParams(window.location.search).get('leadId');
  const urlLeadDismissed = React.useRef(false);

  // Broker leads (referral partners) state
  const [brokerSearch, setBrokerSearch] = useState('');
  const [brokerFilterStatus, setBrokerFilterStatus] = useState('all');
  const [editingBrokerLead, setEditingBrokerLead] = useState(null);
  const [isAddBrokerOpen, setIsAddBrokerOpen] = useState(false);
  const [brokerForm, setBrokerForm] = useState(EMPTY_BROKER_LEAD_FORM);
  const [syncingBrokers, setSyncingBrokers] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [backfillingSheet, setBackfillingSheet] = useState(false);
  const [viewingBrokerLead, setViewingBrokerLead] = useState(null);
  const [showActivePartnersModal, setShowActivePartnersModal] = useState(false);
  const [brokerViewMode, setBrokerViewMode] = useState('list'); // 'list' | 'pipeline'
  const [brokerFilterOwner, setBrokerFilterOwner] = useState('all');
  const [brokerTagFilter, setBrokerTagFilter] = useState([]);
  const [brokerTagMatchAll, setBrokerTagMatchAll] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  // Duplicate cleanup state (lifted up so button lives in header)
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState(null);
  const [duplicateMergeResult, setDuplicateMergeResult] = useState(null);

  const handleScanDuplicates = async () => {
    setScanningDuplicates(true);
    setDuplicates(null);
    setDuplicateMergeResult(null);
    try {
      const res = await base44.functions.invoke('mergePartnerDuplicates', { dryRun: true });
      setDuplicates(res.data.duplicates || []);
    } catch (e) {
      toast.error('Scan failed: ' + e.message);
    } finally {
      setScanningDuplicates(false);
    }
  };

  // Referral Portals (ReferralPartnerAdmin) state
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER_FORM);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedPartner, setExpandedPartner] = useState(null);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [showPendingReview, setShowPendingReview] = useState(false);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: brokerViewMode === 'pipeline' ? 60_000 : false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: referralPartners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.list('-created_date')
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date')
  });

  const pendingReferrals = referrals.filter(r => r.status === 'pending_review');

  React.useEffect(() => {
    if (leadIdFromUrl && !urlLeadDismissed.current) {
      const lead = (allLeads || []).find(l => l.id === leadIdFromUrl);
      if (lead) {
        setActiveTab('broker_leads');
        setViewingBrokerLead(lead);
      }
    }
  }, [leadIdFromUrl, allLeads]);

  const existingCompanies = [...new Set(referralPartners.map(p => p.company).filter(Boolean))].sort();

  const savePartnerMutation = useMutation({
    mutationFn: async (data) => {
      if (editingPartner) return base44.entities.ReferralPartner.update(editingPartner.id, data);
      return base44.entities.ReferralPartner.create({ ...data, unique_portal_id: generatePortalId() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setShowPartnerDialog(false);
      setEditingPartner(null);
      shadToast({ title: editingPartner ? 'Partner updated' : 'Partner created' });
    }
  });

  const deletePartnerMutation = useMutation({
    mutationFn: (id) => base44.entities.ReferralPartner.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      setShowPartnerDialog(false);
      setEditingPartner(null);
      shadToast({ title: 'Partner deleted' });
    }
  });

  const [newReferralForm, setNewReferralForm] = useState({ contact_name: '', contact_email: '', company_name: '', notes: '' });
  const [showAddReferral, setShowAddReferral] = useState(false);

  const addReferralMutation = useMutation({
    mutationFn: (data) => base44.entities.Referral.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      setNewReferralForm({ contact_name: '', contact_email: '', company_name: '', notes: '' });
      setShowAddReferral(false);
      shadToast({ title: 'Referral added' });
    }
  });

  const deleteReferralMutation = useMutation({
    mutationFn: (id) => base44.entities.Referral.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      shadToast({ title: 'Referral deleted' });
    }
  });

  const openNewPartner = () => { setEditingPartner(null); setPartnerForm(EMPTY_PARTNER_FORM); setShowPartnerDialog(true); };
  const openEditPartner = (partner) => {
    setEditingPartner(partner);
    setPartnerForm({
      name: partner.name || '', email: partner.email || '', company: partner.company || '',
      phone: partner.phone || '', notes: partner.notes || '',
      agreement_file_url: partner.agreement_file_url || '',
      agreement_signed_date: partner.agreement_signed_date || '',
      commission_tiers: partner.commission_tiers?.length ? partner.commission_tiers : DEFAULT_TIERS,
      is_active: partner.is_active !== false
    });
    setShowAddReferral(false);
    setNewReferralForm({ contact_name: '', contact_email: '', company_name: '', notes: '' });
    setShowPartnerDialog(true);
  };
  const copyPortalLink = (partner) => {
    navigator.clipboard.writeText(`${window.location.origin}/ReferralPortal?id=${partner.unique_portal_id}`);
    setCopiedId(partner.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const updateTier = (i, field, value) => {
    const tiers = [...partnerForm.commission_tiers];
    tiers[i] = { ...tiers[i], [field]: field === 'rate' ? parseFloat(value) || 0 : field.includes('revenue') ? (value === '' ? null : parseFloat(value)) : value };
    setPartnerForm(f => ({ ...f, commission_tiers: tiers }));
  };

  const clientEmails = new Set(clients.map(c => c.email?.toLowerCase()).filter(Boolean));

  // Split leads by type
  const outreachLeads = allLeads.filter(l => l.lead_type !== 'broker_lead');
  const partnerLeads = allLeads.filter(l => l.lead_type === 'broker_lead');
  // alias for backward compat with existing references
  const brokerLeads = partnerLeads;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newLead = await base44.entities.Lead.create(data);
      // Append to Google Sheet and save back the row reference (fire-and-forget style but
      // we do await so we can persist sheet_row_id — non-blocking error)
      try {
        const appendRes = await base44.functions.invoke('syncBrokerLeadsSheet', {
          action: 'appendLead',
          name: data.name,
          title: data.title,
          owner: data.owner,
          email: data.email,
          company: data.company,
          follow_up_stage: data.follow_up_stage,
          notes: data.notes,
          source: data.source,
          phone: data.phone,
          industry: data.industry,
          tags: data.tags || [],
        });
        const { rowNumber, targetSheet } = appendRes.data || {};
        if (rowNumber) {
          await base44.entities.Lead.update(newLead.id, {
            sheet_row_id: String(rowNumber),
            sheet_origin: `BrokerLeads:${targetSheet || 'Referral Partners'}`,
          });
        }
      } catch (e) {
        console.warn('Sheet append failed (non-critical):', e.message);
      }
      return newLead;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setIsAddBrokerOpen(false); setBrokerForm(EMPTY_BROKER_LEAD_FORM); toast.success('Lead added'); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setEditingBrokerLead(null); toast.success('Lead updated'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead deleted'); }
  });

  const handleBrokerLeadSubmit = (e) => {
    e.preventDefault();
    const data = { ...brokerForm };
    if (!data.last_contacted_date) delete data.last_contacted_date;
    if (!data.next_followup_date) delete data.next_followup_date;
    if (!data.last_referral_date) delete data.last_referral_date;
    if (editingBrokerLead) updateMutation.mutate({ id: editingBrokerLead.id, data });
    else createMutation.mutate(data);
  };

  const openEditBrokerLead = (lead) => {
    setBrokerForm({
      name: lead.name || '', email: lead.email || '', email2: lead.email2 || '',
      company: lead.company || '', title: lead.title || '', phone: lead.phone || '',
      industry: lead.industry || '', status: lead.status || 'cold',
      outreach_channel: lead.outreach_channel || 'email',
      last_contacted_date: lead.last_contacted_date || '',
      next_followup_date: lead.next_followup_date || '',
      notes: lead.notes || '', source: lead.source || '', lead_type: 'broker_lead',
      partner_status: lead.partner_status || 'new',
      follow_up_stage: lead.follow_up_stage || '',
      referral_potential: lead.referral_potential || 'medium',
      referral_count: lead.referral_count || 0,
      last_referral_date: lead.last_referral_date || ''
    });
    setEditingBrokerLead(lead);
  };

  // Sync broker leads sheet (one-way, high quality referral partners)
  const handleSyncBrokerLeads = async () => {
    setSyncingBrokers(true);
    try {
      let startRow = 0;
      let totalCreated = 0, totalUpdated = 0;
      while (true) {
        const res = await base44.functions.invoke('syncBrokerLeadsSheet', { startRow });
        const d = res.data || {};
        totalCreated += d.created || 0;
        totalUpdated += d.updated || 0;
        if (!d.hasMore) break;
        startRow = d.nextStartRow;
      }
      toast.success(`Partner leads synced — ${totalCreated} new, ${totalUpdated} updated`);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.refetchQueries({ queryKey: ['leads'] });
    } catch (e) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setSyncingBrokers(false);
    }
  };

  // Sync Gmail for broker leads
  const handleEmailSync = async () => {
    setSyncingEmail(true);
    try {
      const res = await base44.functions.invoke('updateLastContactedFromGmail', {});
      const d = res.data || {};
      toast.success(`Email sync complete — ${d.updated || 0} leads updated`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (e) {
      toast.error('Email sync failed: ' + e.message);
    } finally {
      setSyncingEmail(false);
    }
  };

  // Backfill app → sheet: append leads not yet in the Google Sheet
  const handleBackfillToSheet = async () => {
    setBackfillingSheet(true);
    try {
      let startRow = 0;
      let totalAppended = 0;
      let totalSkipped = 0;
      while (true) {
        const res = await base44.functions.invoke('backfillLeadsToSheet', { startRow });
        const d = res.data || {};
        totalAppended += d.appended || 0;
        totalSkipped += d.skipped || 0;
        if (!d.hasMore) break;
        startRow = d.nextStartRow;
      }
      toast.success(`Backfill complete — ${totalAppended} appended, ${totalSkipped} skipped`);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (e) {
      toast.error('Backfill failed: ' + e.message);
    } finally {
      setBackfillingSheet(false);
    }
  };

  const brokerOwners = [...new Set(brokerLeads.map(l => l.owner).filter(Boolean))].sort();

  const filteredBrokerLeads = brokerLeads.filter(lead => {
    const matchSearch = !brokerSearch ||
      lead.name?.toLowerCase().includes(brokerSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(brokerSearch.toLowerCase()) ||
      lead.company?.toLowerCase().includes(brokerSearch.toLowerCase());
    const matchStatus = brokerFilterStatus === 'all' || (lead.status || 'cold') === brokerFilterStatus;
    const matchOwner = brokerFilterOwner === 'all' || lead.owner === brokerFilterOwner;
    const matchTags = brokerTagFilter.length === 0 || (brokerTagMatchAll
      ? brokerTagFilter.every(t => lead.tags?.includes(t))
      : brokerTagFilter.some(t => lead.tags?.includes(t)));
    return matchSearch && matchStatus && matchOwner && matchTags;
  });

  const BrokerLeadCard = ({ lead }) => {
    const [showEmails, setShowEmails] = useState(false);
    const statusCfg = STATUS_CONFIG[lead.status || 'cold'] || STATUS_CONFIG.cold;
    const partnerCfg = PARTNER_STATUS_CONFIG[lead.partner_status || 'new'] || PARTNER_STATUS_CONFIG.new;
    const referralCfg = REFERRAL_POTENTIAL_CONFIG[lead.referral_potential] || null;
    const sourceParts = (lead.source || '').split(' | ');
    const linkedinUrl = sourceParts[1] || '';
    const isActive = lead.partner_status === 'active_partner';

    const recentReferrals = (lead.referral_history || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    const daysSince = (dateStr) => {
      if (!dateStr) return null;
      const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Today';
      if (diff === 1) return '1 day ago';
      if (diff < 30) return `${diff}d ago`;
      if (diff < 60) return '~1mo ago';
      return `${Math.floor(diff / 30)}mo ago`;
    };

    const lastContactedAgo = daysSince(lead.last_contacted_date);
    const contactedDiff = lead.last_contacted_date
      ? Math.floor((new Date() - new Date(lead.last_contacted_date)) / (1000 * 60 * 60 * 24))
      : null;
    const contactUrgency = contactedDiff === null ? '' : contactedDiff > 60 ? 'text-red-500' : contactedDiff > 30 ? 'text-amber-600' : 'text-green-600';

    return (
      <div className={`bg-white rounded-xl shadow p-4 border-l-4 ${isActive ? 'border-green-500' : 'border-[#013f7c]/20'}`}>
        {/* Active Partner Banner */}
        {isActive && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-green-100">
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200">
              <Star className="w-3 h-3 fill-green-500 text-green-500" /> Active Referral Partner
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="font-semibold text-gray-800 hover:text-[#013f7c] hover:underline text-left"
                onClick={() => setViewingBrokerLead(lead)}
              >
                {lead.name}
              </button>
              {!isActive && lead.follow_up_stage && (
                <Badge variant="outline" className={`text-xs ${getStageColor(lead.follow_up_stage)}`}>
                  {lead.follow_up_stage}
                </Badge>
              )}
              {isActive && <Badge variant="outline" className={`text-xs ${partnerCfg.color}`}>{partnerCfg.label}</Badge>}
              {referralCfg && (
                <Badge variant="outline" className={`text-xs ${referralCfg.color} flex items-center gap-1`}>
                  <Star className="w-3 h-3" />{referralCfg.label} potential
                </Badge>
              )}
              {(lead.referral_count || 0) > 0 && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  {lead.referral_count} referral{lead.referral_count !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {(lead.title || lead.company) && (
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                {lead.title && <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.title}</span>}
                {lead.company && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{lead.company}</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
              {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
              {linkedinUrl && (
                <a href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                  <ExternalLink className="w-3 h-3" />LinkedIn
                </a>
              )}
            </div>

            {/* Always show last contacted + other details */}
            <div className="flex flex-wrap gap-2 mt-2">
              {lead.industry && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{lead.industry}</span>}
              {lead.last_contacted_date && !isActive && (
                <span className={`text-xs font-medium ${contactUrgency}`}>
                  Last contact: {new Date(lead.last_contacted_date).toLocaleDateString()} ({lastContactedAgo})
                </span>
              )}
              {lead.last_contacted_date && isActive && (
                <span className={`text-xs font-medium ${contactUrgency} flex items-center gap-1`}>
                  <Mail className="w-3 h-3" /> Last contact: {new Date(lead.last_contacted_date).toLocaleDateString()} ({lastContactedAgo})
                </span>
              )}
              {!lead.last_contacted_date && (
                <span className="text-xs text-gray-400 italic">No contact date recorded</span>
              )}
              {lead.next_followup_date && <span className="text-xs text-amber-600">Follow-up: {new Date(lead.next_followup_date).toLocaleDateString()}</span>}
            </div>

            {/* Active partner: last 3 referrals */}
            {isActive && recentReferrals.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Last Referrals</p>
                {recentReferrals.map((ref, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-purple-800">{ref.company_name}</span>
                    {ref.contact_name && <span className="text-purple-600">— {ref.contact_name}</span>}
                    <span className="ml-auto text-purple-400 flex-shrink-0">{new Date(ref.date).toLocaleDateString()} · {daysSince(ref.date)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Active: no referrals yet nudge */}
            {isActive && recentReferrals.length === 0 && (
              <p className="mt-2 text-xs text-gray-400 italic">No referrals logged yet — open profile to add one.</p>
            )}

            {lead.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-1">{lead.notes}</p>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(lead.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
        {/* Email history toggle */}
        <button
          onClick={() => setShowEmails(!showEmails)}
          className="mt-3 flex items-center gap-1.5 text-xs text-[#013f7c] hover:text-[#012d5a] font-medium"
        >
          <Mail className="w-3.5 h-3.5" />
          {showEmails ? 'Hide' : 'Show'} Email History
          {showEmails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showEmails && (
          <div className="mt-3 pt-3 border-t">
            <GmailHistory clientEmail={lead.email} />
          </div>
        )}
      </div>
    );
  };

  const TAB_ITEMS = [
    { id: 'broker_leads', label: 'Referral Partners', icon: Star, count: partnerLeads.length },
    { id: 'portals',      label: 'Referral Portals', icon: Share2, count: referralPartners.length, alert: pendingReferrals.length },
  ];

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Sub-nav header — matches Clients style */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#013f7c' }}>Partners</h1>
          </div>
          <div className="flex gap-1">
            {TAB_ITEMS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                    isActive
                      ? 'border-[#264d44] text-[#264d44] bg-[#f4f0e9]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${isActive ? 'bg-[#264d44]/10 text-[#264d44]' : 'bg-gray-100 text-gray-500'}`}>
                    {tab.count}
                  </span>
                  {tab.alert > 0 && (
                    <span className="text-xs rounded-full px-1.5 py-0.5 font-bold bg-amber-500 text-white animate-pulse">
                      {tab.alert}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden" />

          {/* ── Referral Partners Tab ─────────────────────────────────────── */}
          <TabsContent value="broker_leads">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleSyncBrokerLeads} disabled={syncingBrokers} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${syncingBrokers ? 'animate-spin' : ''}`} />
                  {syncingBrokers ? 'Syncing...' : 'Sync Sheet'}
                </Button>
                <Button variant="outline" onClick={handleBackfillToSheet} disabled={backfillingSheet} className="gap-2 text-[#013f7c] border-[#013f7c]/30 hover:bg-[#013f7c]/5" title="Append app-only leads to the Google Sheet">
                  <RefreshCw className={`w-4 h-4 ${backfillingSheet ? 'animate-spin' : ''}`} />
                  {backfillingSheet ? 'Backfilling...' : 'Backfill to Sheet'}
                </Button>
                <Button variant="outline" onClick={handleEmailSync} disabled={syncingEmail} className="gap-2">
                  <Mail className={`w-4 h-4 ${syncingEmail ? 'animate-spin' : ''}`} />
                  {syncingEmail ? 'Syncing...' : 'Sync Emails'}
                </Button>
                <Button variant="outline" onClick={handleScanDuplicates} disabled={scanningDuplicates} className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50" title="Check for duplicate partner records">
                  <GitMerge className={`w-4 h-4 ${scanningDuplicates ? 'animate-spin' : ''}`} />
                  {scanningDuplicates ? 'Scanning…' : 'Check Duplicates'}
                </Button>
                <a
                  href="https://docs.google.com/spreadsheets/d/1QyVdp7XWFfUkZyqLMVn6P39X84WgYWOHfqI2US7WKWk/edit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors text-green-700 border-green-300"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Sheet
                </a>
              </div>
              <div className="flex gap-2">
                <Button className="bg-[#013f7c] hover:bg-[#012d5a] gap-2" onClick={() => { setBrokerForm(EMPTY_BROKER_LEAD_FORM); setEditingBrokerLead(null); setIsAddBrokerOpen(true); }}>
                  <Plus className="w-4 h-4" /> Add Partner
                </Button>

              </div>
            </div>

            <MergePartnerDuplicatesPanel
              duplicates={duplicates}
              mergeResult={duplicateMergeResult}
              onMergeComplete={(result) => {
                setDuplicateMergeResult(result);
                setDuplicates(null);
                queryClient.invalidateQueries({ queryKey: ['leads', 'referralPartners'] });
              }}
            />

            {/* View toggle + filters */}
            <div className="flex gap-2 flex-wrap mb-4 items-center">
              {/* View toggle */}
              <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setBrokerViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${brokerViewMode === 'list' ? 'bg-[#013f7c] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" /> List
                </button>
                <button
                  onClick={() => setBrokerViewMode('pipeline')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${brokerViewMode === 'pipeline' ? 'bg-[#013f7c] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Kanban className="w-4 h-4" /> Pipeline
                </button>
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search by name, email, company..." className="pl-10 bg-white" value={brokerSearch} onChange={e => setBrokerSearch(e.target.value)} />
              </div>

              {brokerViewMode === 'list' && (
                <Select value={brokerFilterStatus} onValueChange={setBrokerFilterStatus}>
                  <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {brokerOwners.length > 0 && (
                <Select value={brokerFilterOwner} onValueChange={setBrokerFilterOwner}>
                  <SelectTrigger className="w-[150px] bg-white"><SelectValue placeholder="All Owners" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {brokerOwners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <TagFilter
                selected={brokerTagFilter}
                onChange={setBrokerTagFilter}
                matchAll={brokerTagMatchAll}
                onMatchAllChange={setBrokerTagMatchAll}
              />

              <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setShowTagManager(true)}>
                <Settings className="w-4 h-4" /> Manage Tags
              </Button>
            </div>

            {(brokerTagFilter.length > 0 || brokerTagMatchAll) && (
              <div className="mb-3 text-sm text-gray-500">
                Tag filter: {brokerTagFilter.length > 0
                  ? `${brokerTagFilter.join(brokerTagMatchAll ? ' AND ' : ' OR ')}`
                  : 'none'} — Showing {filteredBrokerLeads.length} of {brokerLeads.length} partners
              </div>
            )}

            {brokerViewMode === 'pipeline' ? (
              <PipelineView
                leads={filteredBrokerLeads}
                onSelectLead={(lead) => setViewingBrokerLead(lead)}
                onStageChange={(leadId, newStage) => {
                  queryClient.setQueryData(['leads'], (old) =>
                    (old || []).map(l => l.id === leadId ? { ...l, follow_up_stage: newStage } : l)
                  );
                }}
              />
            ) : isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : filteredBrokerLeads.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow">
                <Star className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500">No partner leads yet. Sync your Google Sheet to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBrokerLeads.map(lead => <BrokerLeadCard key={lead.id} lead={lead} />)}
              </div>
            )}
          </TabsContent>
          {/* ── Referral Portals Tab ─────────────────────────────────────── */}
          <TabsContent value="portals">
            {pendingReferrals.length > 0 && (
              <button
                onClick={() => setShowPendingReview(true)}
                className="w-full mb-5 flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors text-left group"
              >
                <div className="flex-shrink-0 bg-amber-400 text-white rounded-full p-2">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">
                    {pendingReferrals.length} referral{pendingReferrals.length !== 1 ? 's' : ''} awaiting review
                  </p>
                  <p className="text-sm text-amber-600">
                    New referrals must be approved before they count toward partner totals. Click to review.
                  </p>
                </div>
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
              </button>
            )}
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-gray-500">Manage active referral partners and their portal access</p>
              <Button onClick={openNewPartner} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
                <Plus className="w-4 h-4" /> Add Partner
              </Button>
            </div>
            {partnersLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-[#013f7c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : referralPartners.length === 0 ? (
              <Card><CardContent className="text-center py-16">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No referral partners yet. Add your first partner to get started.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {referralPartners.map(partner => {
                  const partnerReferrals = referrals.filter(r => r.referral_partner_id === partner.id);
                  const totalCommission = partnerReferrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
                  const totalRevenue = partnerReferrals.reduce((sum, r) => sum + (r.first_year_revenue || 0), 0);
                  const convertedReferrals = partnerReferrals.filter(r => ['converted_to_client','purchased','commission_paid'].includes(r.status));
                  const pendingCommission = partnerReferrals.filter(r => r.status === 'purchased').reduce((sum, r) => sum + (r.commission_amount || 0), 0);
                  const paidCommission = partnerReferrals.filter(r => r.status === 'commission_paid').reduce((sum, r) => sum + (r.commission_amount || 0), 0);

                  // Determine current tier
                  const ytd = partner.ytd_revenue || 0;
                  const tiers = partner.commission_tiers || [];
                  const currentTier = tiers.slice().reverse().find(t => ytd >= (t.min_revenue || 0));

                  return (
                    <Card key={partner.id}>
                      <CardContent className="pt-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-800 text-lg">{partner.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${partner.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {partner.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                              {currentTier && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{currentTier.label}</span>}
                            </div>
                            {partner.company && <p className="text-gray-500 text-sm">{partner.company}</p>}
                            <p className="text-gray-400 text-sm">{partner.email}</p>

                            {/* Financial summary grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                              <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-xs text-blue-600 font-medium">Referrals</p>
                                <p className="text-lg font-bold text-blue-800">{partnerReferrals.length}</p>
                                <p className="text-xs text-blue-500">{convertedReferrals.length} converted</p>
                              </div>
                              <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-xs text-emerald-600 font-medium">Total Revenue</p>
                                <p className="text-lg font-bold text-emerald-800">${totalRevenue.toLocaleString()}</p>
                                <p className="text-xs text-emerald-500">YTD: ${ytd.toLocaleString()}</p>
                              </div>
                              <div className="bg-amber-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-xs text-amber-600 font-medium">Pending Comm.</p>
                                <p className="text-lg font-bold text-amber-800">${pendingCommission.toLocaleString()}</p>
                                <p className="text-xs text-amber-500">awaiting payment</p>
                              </div>
                              <div className="bg-purple-50 rounded-lg px-3 py-2 text-center">
                                <p className="text-xs text-purple-600 font-medium">Paid Comm.</p>
                                <p className="text-lg font-bold text-purple-800">${paidCommission.toLocaleString()}</p>
                                <p className="text-xs text-purple-500">of ${totalCommission.toLocaleString()} total</p>
                              </div>
                            </div>

                            {partner.agreement_signed_date && <p className="text-gray-400 text-xs mt-2">Agreement signed {format(new Date(partner.agreement_signed_date), 'MMM d, yyyy')}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => copyPortalLink(partner)}>
                              {copiedId === partner.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                              {copiedId === partner.id ? 'Copied!' : 'Copy Link'}
                            </Button>
                            <a href={`/ReferralPortal?id=${partner.unique_portal_id}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="gap-1"><ExternalLink className="w-4 h-4" /> Portal</Button>
                            </a>
                            <Button variant="outline" size="sm" onClick={() => openEditPartner(partner)} className="gap-1"><Edit className="w-4 h-4" /> Edit</Button>
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
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REFERRAL_STATUS_COLORS[r.status] || 'bg-blue-100 text-blue-700'}`}>{r.status?.replace(/_/g, ' ')}</span>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Referral Partner Add/Edit Dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={v => { setShowPartnerDialog(v); if (!v) { setEditingPartner(null); setShowAddReferral(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{editingPartner ? 'Edit Partner' : 'Add Referral Partner'}</DialogTitle>
              {editingPartner && (
                <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1"
                  onClick={() => { if (window.confirm('Delete this partner portal? This cannot be undone.')) deletePartnerMutation.mutate(editingPartner.id); }}>
                  <Trash2 className="w-4 h-4" /> Delete Portal
                </Button>
              )}
            </div>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); savePartnerMutation.mutate(partnerForm); }} className="space-y-5 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name *</label>
                <Input value={partnerForm.name} onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Email *</label>
                <Input type="email" value={partnerForm.email} onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 block mb-1">Company</label>
                <div className="flex gap-1">
                  <Input value={partnerForm.company} onChange={e => setPartnerForm(f => ({ ...f, company: e.target.value }))} placeholder="Type or select company"
                    onFocus={() => setCompanyDropdownOpen(true)} onBlur={() => setTimeout(() => setCompanyDropdownOpen(false), 150)} />
                  {existingCompanies.length > 0 && (
                    <Button type="button" variant="outline" size="icon" className="shrink-0" onMouseDown={e => { e.preventDefault(); setCompanyDropdownOpen(o => !o); }}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {companyDropdownOpen && existingCompanies.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {existingCompanies.filter(c => !partnerForm.company || c.toLowerCase().includes(partnerForm.company.toLowerCase())).map(c => (
                      <button key={c} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                        onMouseDown={() => { setPartnerForm(f => ({ ...f, company: c })); setCompanyDropdownOpen(false); }}>{c}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
                <Input value={partnerForm.phone} onChange={e => setPartnerForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Agreement File URL</label>
                <Input value={partnerForm.agreement_file_url} onChange={e => setPartnerForm(f => ({ ...f, agreement_file_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Agreement Signed Date</label>
                <Input type="date" value={partnerForm.agreement_signed_date} onChange={e => setPartnerForm(f => ({ ...f, agreement_signed_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Commission Tiers</label>
              <div className="space-y-2">
                {partnerForm.commission_tiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center p-3 bg-gray-50 rounded-lg">
                    <Input value={tier.label} onChange={e => updateTier(i, 'label', e.target.value)} placeholder="Label" className="text-sm" />
                    <Input type="number" value={tier.min_revenue} onChange={e => updateTier(i, 'min_revenue', e.target.value)} placeholder="Min $" className="text-sm" />
                    <Input type="number" value={tier.max_revenue ?? ''} onChange={e => updateTier(i, 'max_revenue', e.target.value)} placeholder="Max $ (blank=∞)" className="text-sm" />
                    <div className="flex items-center gap-1">
                      <Input type="number" step="0.001" min="0" max="1" value={tier.rate} onChange={e => updateTier(i, 'rate', e.target.value)} placeholder="Rate" className="text-sm" />
                      <span className="text-gray-500 text-sm">{(tier.rate * 100 % 1 === 0 ? (tier.rate * 100).toFixed(0) : (tier.rate * 100).toFixed(1))}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <Textarea value={partnerForm.notes} onChange={e => setPartnerForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active_partner" checked={partnerForm.is_active} onChange={e => setPartnerForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
              <label htmlFor="is_active_partner" className="text-sm text-gray-700">Active Partner</label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={savePartnerMutation.isPending} className="bg-[#013f7c] hover:bg-[#012d5a] text-white">
                {savePartnerMutation.isPending ? 'Saving...' : editingPartner ? 'Save Changes' : 'Create Partner'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowPartnerDialog(false)}>Cancel</Button>
            </div>
          </form>

          {/* Referrals section — only when editing */}
          {editingPartner && (() => {
            const partnerReferrals = referrals.filter(r => r.referral_partner_id === editingPartner.id);
            return (
              <div className="border-t pt-5 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Referrals ({partnerReferrals.length})</h3>
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setShowAddReferral(v => !v)}>
                    <Plus className="w-3.5 h-3.5" /> Add Referral
                  </Button>
                </div>

                {/* Add referral form */}
                {showAddReferral && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">New Referral</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Contact Name *</label>
                        <Input className="bg-white" value={newReferralForm.contact_name} onChange={e => setNewReferralForm(f => ({ ...f, contact_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Contact Email</label>
                        <Input className="bg-white" type="email" value={newReferralForm.contact_email} onChange={e => setNewReferralForm(f => ({ ...f, contact_email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Company</label>
                        <Input className="bg-white" value={newReferralForm.company_name} onChange={e => setNewReferralForm(f => ({ ...f, company_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Notes</label>
                        <Input className="bg-white" value={newReferralForm.notes} onChange={e => setNewReferralForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="bg-[#013f7c] hover:bg-[#012d5a] text-white"
                        disabled={!newReferralForm.contact_name || addReferralMutation.isPending}
                        onClick={() => addReferralMutation.mutate({
                          referral_partner_id: editingPartner.id,
                          referral_partner_name: editingPartner.name,
                          contact_name: newReferralForm.contact_name,
                          contact_email: newReferralForm.contact_email,
                          company_name: newReferralForm.company_name,
                          notes: newReferralForm.notes,
                          referral_date: new Date().toISOString(),
                          status: 'pending_review'
                        })}>
                        {addReferralMutation.isPending ? 'Adding...' : 'Add Referral'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setShowAddReferral(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Existing referrals list */}
                {partnerReferrals.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-2">No referrals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {partnerReferrals.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{r.contact_name}</span>
                          {r.company_name && <span className="text-gray-500 ml-1.5">— {r.company_name}</span>}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${REFERRAL_STATUS_COLORS[r.status] || 'bg-blue-100 text-blue-700'}`}>{r.status?.replace(/_/g, ' ')}</span>
                            {r.referral_date && <span className="text-xs text-gray-400">{format(new Date(r.referral_date), 'MMM d, yyyy')}</span>}
                            {r.commission_amount > 0 && <span className="text-xs text-green-700 font-medium">${r.commission_amount.toLocaleString()} comm.</span>}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-red-400 hover:text-red-600 shrink-0"
                          onClick={() => { if (window.confirm('Delete this referral?')) deleteReferralMutation.mutate(r.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Active Partners Quick-Pick Modal */}
      <Dialog open={showActivePartnersModal} onOpenChange={setShowActivePartnersModal}>
        <DialogContent className="max-w-md w-[95vw] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Handshake className="w-5 h-5" /> Active Partners
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-2 mt-2">
            {brokerLeads.filter(l => l.partner_status === 'active_partner').length === 0 ? (
              <p className="text-center text-gray-400 py-8">No active partners yet.</p>
            ) : brokerLeads
              .filter(l => l.partner_status === 'active_partner')
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map(lead => {
                const contactedDiff = lead.last_contacted_date
                  ? Math.floor((new Date() - new Date(lead.last_contacted_date)) / (1000 * 60 * 60 * 24))
                  : null;
                const urgencyColor = contactedDiff === null ? 'text-gray-400' : contactedDiff > 60 ? 'text-red-500' : contactedDiff > 30 ? 'text-amber-600' : 'text-green-600';
                return (
                  <button
                    key={lead.id}
                    onClick={() => { setShowActivePartnersModal(false); setViewingBrokerLead(lead); }}
                    className="w-full text-left bg-white border border-green-100 hover:border-green-400 hover:shadow-sm rounded-lg px-4 py-3 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">{lead.name}</p>
                        {lead.company && <p className="text-xs text-gray-500">{lead.company}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {lead.last_contacted_date ? (
                          <p className={`text-xs font-medium ${urgencyColor}`}>
                            {new Date(lead.last_contacted_date).toLocaleDateString()}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No contact</p>
                        )}
                        {(lead.referral_count || 0) > 0 && (
                          <p className="text-xs text-purple-600 mt-0.5">{lead.referral_count} referral{lead.referral_count !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            }
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Referral Review Dialog */}
      <PendingReferralsReview open={showPendingReview} onOpenChange={setShowPendingReview} />

      {/* Partner Lead Detail Modal */}
      {viewingBrokerLead && (
        <BrokerLeadDetail
          lead={viewingBrokerLead}
          onClose={() => { urlLeadDismissed.current = true; setViewingBrokerLead(null); }}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            // Keep modal open but refresh local lead data via the list refetch
          }}
        />
      )}

      {/* Tag Manager Dialog */}
      <TagManager open={showTagManager} onOpenChange={setShowTagManager} />

      {/* Partner Lead Add/Edit Dialog */}
      <Dialog open={isAddBrokerOpen || !!editingBrokerLead} onOpenChange={(open) => { if (!open) { setIsAddBrokerOpen(false); setEditingBrokerLead(null); } }}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBrokerLead ? 'Edit Partner Lead' : 'Add Partner Lead'}</DialogTitle></DialogHeader>
          <form onSubmit={handleBrokerLeadSubmit} className="space-y-3 mt-2">
            {/* Contact Identity */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Info</p>
              <Input placeholder="Name *" value={brokerForm.name} onChange={e => setBrokerForm({...brokerForm, name: e.target.value})} required />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email 1 *</label>
                  <Input type="email" placeholder="Primary email" value={brokerForm.email} onChange={e => setBrokerForm({...brokerForm, email: e.target.value})} required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email 2</label>
                  <Input type="email" placeholder="Secondary email" value={brokerForm.email2} onChange={e => setBrokerForm({...brokerForm, email2: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Company" value={brokerForm.company} onChange={e => setBrokerForm({...brokerForm, company: e.target.value})} />
              <Input placeholder="Title" value={brokerForm.title} onChange={e => setBrokerForm({...brokerForm, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Phone" value={brokerForm.phone} onChange={e => setBrokerForm({...brokerForm, phone: e.target.value})} />
              <Input placeholder="Industry" value={brokerForm.industry} onChange={e => setBrokerForm({...brokerForm, industry: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Outreach Status</label>
                <Select value={brokerForm.status} onValueChange={v => setBrokerForm({...brokerForm, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'current_client').map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Partner Status</label>
                <Select value={brokerForm.partner_status} onValueChange={v => setBrokerForm({...brokerForm, partner_status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARTNER_STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Follow-up Stage</label>
              <Select value={brokerForm.follow_up_stage || 'none'} onValueChange={v => setBrokerForm({...brokerForm, follow_up_stage: v === 'none' ? '' : v})}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Stage</SelectItem>
                  {FOLLOW_UP_STAGES.filter(s => s).map((stage, i) => (
                    <SelectItem key={i} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Referral Potential</label>
                <Select value={brokerForm.referral_potential} onValueChange={v => setBrokerForm({...brokerForm, referral_potential: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Channel</label>
                <Select value={brokerForm.outreach_channel} onValueChange={v => setBrokerForm({...brokerForm, outreach_channel: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['email','linkedin','phone','referral','other'].map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Last Contacted</label>
                <Input type="date" value={brokerForm.last_contacted_date} onChange={e => setBrokerForm({...brokerForm, last_contacted_date: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Next Follow-up</label>
                <Input type="date" value={brokerForm.next_followup_date} onChange={e => setBrokerForm({...brokerForm, next_followup_date: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Referral Count</label>
                <Input type="number" min="0" value={brokerForm.referral_count} onChange={e => setBrokerForm({...brokerForm, referral_count: parseInt(e.target.value) || 0})} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Last Referral Date</label>
                <Input type="date" value={brokerForm.last_referral_date} onChange={e => setBrokerForm({...brokerForm, last_referral_date: e.target.value})} />
              </div>
            </div>
            <Textarea placeholder="Notes" value={brokerForm.notes} onChange={e => setBrokerForm({...brokerForm, notes: e.target.value})} rows={3} />
            <Button type="submit" className="w-full bg-[#013f7c] hover:bg-[#012d5a]">
              {editingBrokerLead ? 'Save Changes' : 'Add Partner Lead'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}