import React, { useState } from 'react';
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
import { Search, Plus, Building, Mail, Phone, Pencil, Trash2, RefreshCw, UserCheck, MapPin, ExternalLink, User, Star, Users, ChevronDown, ChevronUp, TrendingUp, AlertCircle, Handshake, Clock, ScanText } from 'lucide-react';
import GmailHistory from '@/components/clients/GmailHistory';
import BrokerLeadDetail from '@/components/leads/BrokerLeadDetail';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_CONFIG = {
  cold:               { label: 'Cold',              color: 'bg-slate-100 text-slate-700 border-slate-300', chart: '#94a3b8' },
  contacted:          { label: 'Contacted',          color: 'bg-blue-100 text-blue-700 border-blue-300',   chart: '#3b82f6' },
  responded:          { label: 'Responded',          color: 'bg-purple-100 text-purple-700 border-purple-300', chart: '#a855f7' },
  meeting_scheduled:  { label: 'Meeting Scheduled',  color: 'bg-amber-100 text-amber-700 border-amber-300',  chart: '#f59e0b' },
  proposal_sent:      { label: 'Proposal Sent',      color: 'bg-orange-100 text-orange-700 border-orange-300', chart: '#f97316' },
  converted:          { label: 'Converted ✓',        color: 'bg-green-100 text-green-700 border-green-300',  chart: '#22c55e' },
  not_interested:     { label: 'Not Interested',     color: 'bg-red-100 text-red-700 border-red-300',       chart: '#ef4444' },
  current_client:     { label: 'Current Client',     color: 'bg-teal-100 text-teal-800 border-teal-400 font-semibold', chart: '#14b8a6' },
};

const PARTNER_STATUS_CONFIG = {
  new:            { label: 'New',            color: 'bg-slate-100 text-slate-700 border-slate-300', chart: '#94a3b8' },
  nurturing:      { label: 'Nurturing',      color: 'bg-blue-100 text-blue-700 border-blue-300',   chart: '#3b82f6' },
  active_partner: { label: 'Active Partner', color: 'bg-green-100 text-green-700 border-green-300', chart: '#22c55e' },
  inactive:       { label: 'Inactive',       color: 'bg-red-100 text-red-700 border-red-300',      chart: '#ef4444' },
};

const REFERRAL_POTENTIAL_CONFIG = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  high:   { label: 'High',   color: 'bg-green-100 text-green-700' },
};

const EMPTY_FORM = {
  name: '', email: '', company: '', title: '', phone: '',
  industry: '', company_size: '', status: 'cold',
  outreach_channel: 'email', last_contacted_date: '',
  next_followup_date: '', notes: '', source: '', lead_type: 'broker'
};

const EMPTY_BROKER_LEAD_FORM = {
  name: '', email: '', email2: '', company: '', title: '', phone: '',
  industry: '', status: 'cold', outreach_channel: 'email',
  last_contacted_date: '', next_followup_date: '', notes: '', source: '',
  lead_type: 'broker_lead', partner_status: 'new',
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

export default function Leads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('broker_leads');

  // Outreach brokers state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingLead, setEditingLead] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [syncing, setSyncing] = useState(false);

  // Broker leads (referral partners) state
  const [brokerSearch, setBrokerSearch] = useState('');
  const [brokerFilterStatus, setBrokerFilterStatus] = useState('all');
  const [editingBrokerLead, setEditingBrokerLead] = useState(null);
  const [isAddBrokerOpen, setIsAddBrokerOpen] = useState(false);
  const [brokerForm, setBrokerForm] = useState(EMPTY_BROKER_LEAD_FORM);
  const [syncingBrokers, setSyncingBrokers] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [viewingBrokerLead, setViewingBrokerLead] = useState(null);
  const [showActivePartnersModal, setShowActivePartnersModal] = useState(false);

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date')
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const clientEmails = new Set(clients.map(c => c.email?.toLowerCase()).filter(Boolean));

  // Split leads by type
  const outreachLeads = allLeads.filter(l => l.lead_type !== 'broker_lead');
  const brokerLeads = allLeads.filter(l => l.lead_type === 'broker_lead');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setIsAddOpen(false); setIsAddBrokerOpen(false); setForm(EMPTY_FORM); setBrokerForm(EMPTY_BROKER_LEAD_FORM); toast.success('Lead added'); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setEditingLead(null); setEditingBrokerLead(null); toast.success('Lead updated'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); toast.success('Lead deleted'); }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (!data.last_contacted_date) delete data.last_contacted_date;
    if (!data.next_followup_date) delete data.next_followup_date;
    if (editingLead) updateMutation.mutate({ id: editingLead.id, data });
    else createMutation.mutate(data);
  };

  const handleBrokerLeadSubmit = (e) => {
    e.preventDefault();
    const data = { ...brokerForm };
    if (!data.last_contacted_date) delete data.last_contacted_date;
    if (!data.next_followup_date) delete data.next_followup_date;
    if (!data.last_referral_date) delete data.last_referral_date;
    if (editingBrokerLead) updateMutation.mutate({ id: editingBrokerLead.id, data });
    else createMutation.mutate(data);
  };

  const openEdit = (lead) => {
    setForm({
      name: lead.name || '', email: lead.email || '', company: lead.company || '',
      title: lead.title || '', phone: lead.phone || '', industry: lead.industry || '',
      company_size: lead.company_size || '', status: lead.status || 'cold',
      outreach_channel: lead.outreach_channel || 'email',
      last_contacted_date: lead.last_contacted_date || '',
      next_followup_date: lead.next_followup_date || '',
      notes: lead.notes || '', source: lead.source || '', lead_type: lead.lead_type || 'broker'
    });
    setEditingLead(lead);
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
      referral_potential: lead.referral_potential || 'medium',
      referral_count: lead.referral_count || 0,
      last_referral_date: lead.last_referral_date || ''
    });
    setEditingBrokerLead(lead);
  };

  // Sync outreach sheet (existing Brokers + ECs)
  const syncSheet = async (sheetName) => {
    let startRow = 0;
    let totalCreated = 0, totalUpdated = 0;
    while (true) {
      const res = await base44.functions.invoke('syncColdLeadsSheet', { startRow, sheetName });
      const d = res.data || {};
      totalCreated += d.created || 0;
      totalUpdated += d.updatedFromSheet || 0;
      if (!d.hasMore) break;
      startRow = d.nextStartRow;
    }
    return { totalCreated, totalUpdated };
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const brokers = await syncSheet('Brokers');
      const consultants = await syncSheet('ECs');
      const totalCreated = brokers.totalCreated + consultants.totalCreated;
      const totalUpdated = brokers.totalUpdated + consultants.totalUpdated;
      toast.success(`Sync complete — ${totalCreated} new, ${totalUpdated} updated (Brokers + ECs)`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (e) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
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
      toast.success(`Broker leads synced — ${totalCreated} new, ${totalUpdated} updated`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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

  const filteredOutreach = outreachLeads.filter(lead => {
    const matchSearch = !search ||
      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company?.toLowerCase().includes(search.toLowerCase());
    const effectiveStatus = clientEmails.has(lead.email?.toLowerCase()) ? 'current_client' : lead.status;
    const matchStatus = filterStatus === 'all' || effectiveStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredBrokerLeads = brokerLeads.filter(lead => {
    const matchSearch = !brokerSearch ||
      lead.name?.toLowerCase().includes(brokerSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(brokerSearch.toLowerCase()) ||
      lead.company?.toLowerCase().includes(brokerSearch.toLowerCase());
    const matchStatus = brokerFilterStatus === 'all' || (lead.status || 'cold') === brokerFilterStatus;
    return matchSearch && matchStatus;
  });

  const LeadCard = ({ lead }) => {
    const isCurrentClient = clientEmails.has(lead.email?.toLowerCase());
    const effectiveStatus = isCurrentClient ? 'current_client' : (lead.status || 'cold');
    const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.cold;
    const sourceParts = (lead.source || '').split(' | ');
    const location = sourceParts[0] || '';
    const linkedinUrl = sourceParts[1] || '';

    return (
      <div className={`bg-white rounded-xl shadow p-4 border-l-4 ${isCurrentClient ? 'border-teal-500' : 'border-transparent'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">{lead.name}</span>
              <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
              {isCurrentClient && <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-300 gap-1"><UserCheck className="w-3 h-3" /> In Client DB</Badge>}
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
              {location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{location}</span>}
              {linkedinUrl && (
                <a href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                  <ExternalLink className="w-3 h-3" />LinkedIn
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {lead.outreach_channel && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{lead.outreach_channel}</span>}
              {lead.industry && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{lead.industry}</span>}
              {lead.last_contacted_date && <span className="text-xs text-gray-400">Last contacted: {new Date(lead.last_contacted_date).toLocaleDateString()}</span>}
              {lead.next_followup_date && <span className="text-xs text-amber-600">Follow-up: {new Date(lead.next_followup_date).toLocaleDateString()}</span>}
            </div>
            {lead.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{lead.notes}</p>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => openEdit(lead)}><Pencil className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(lead.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    );
  };

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
              <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
              {!isActive && <Badge variant="outline" className={`text-xs ${partnerCfg.color}`}>{partnerCfg.label}</Badge>}
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
            <Button size="sm" variant="outline" onClick={() => openEditBrokerLead(lead)}><Pencil className="w-4 h-4" /></Button>
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
    { id: 'broker_leads', label: 'Referral Partners', icon: Star, count: brokerLeads.length },
    { id: 'outreach',     label: 'Outreach Brokers & ECs', icon: Users, count: outreachLeads.length },
  ];

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Sub-nav header — matches Clients style */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: '#013f7c' }}>Partners</h1>
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
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden" />

          {/* ── Outreach Brokers & ECs Tab ────────────────────────────────── */}
          <TabsContent value="outreach">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Sheet'}
                </Button>
                <Button variant="outline" onClick={handleEmailSync} disabled={syncingEmail} className="gap-2">
                  <Mail className={`w-4 h-4 ${syncingEmail ? 'animate-spin' : ''}`} />
                  {syncingEmail ? 'Syncing...' : 'Sync Emails'}
                </Button>
              </div>
              <Button className="bg-[#264d44] hover:bg-[#1a3830] gap-2" onClick={() => { setForm(EMPTY_FORM); setEditingLead(null); setIsAddOpen(true); }}>
                <Plus className="w-4 h-4" /> Add Broker
              </Button>
            </div>

            <PipelineStats
              leads={outreachLeads} clientEmails={clientEmails}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              statusConfig={STATUS_CONFIG} totalLabel="Total Brokers/ECs"
            />

            <div className="flex gap-2 flex-wrap mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search by name, email, company..." className="pl-10 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : filteredOutreach.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow">
                <p className="text-gray-500">No leads found. Add one or sync your Google Sheet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOutreach.map(lead => <LeadCard key={lead.id} lead={lead} />)}
              </div>
            )}
          </TabsContent>

          {/* ── Referral Partners Tab ─────────────────────────────────────── */}
          <TabsContent value="broker_leads">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSyncBrokerLeads} disabled={syncingBrokers} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${syncingBrokers ? 'animate-spin' : ''}`} />
                  {syncingBrokers ? 'Syncing...' : 'Sync Sheet'}
                </Button>
                <Button variant="outline" onClick={handleEmailSync} disabled={syncingEmail} className="gap-2">
                  <Mail className={`w-4 h-4 ${syncingEmail ? 'animate-spin' : ''}`} />
                  {syncingEmail ? 'Syncing...' : 'Sync Emails'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button className="bg-[#013f7c] hover:bg-[#012d5a] gap-2" onClick={() => { setBrokerForm(EMPTY_BROKER_LEAD_FORM); setEditingBrokerLead(null); setIsAddBrokerOpen(true); }}>
                  <Plus className="w-4 h-4" /> Add Partner
                </Button>
                <Button variant="outline" className="gap-2 border-[#013f7c] text-[#013f7c]" onClick={() => navigate('/AddLead')}>
                  <ScanText className="w-4 h-4" /> Quick Capture
                </Button>
              </div>
            </div>

            <ActivePartnerTiles
              activePartners={brokerLeads.filter(l => l.partner_status === 'active_partner').sort((a, b) => (a.name || '').localeCompare(b.name || ''))}
              onSelect={(lead) => setViewingBrokerLead(lead)}
            />

            <div className="flex gap-2 flex-wrap mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search by name, email, company..." className="pl-10 bg-white" value={brokerSearch} onChange={e => setBrokerSearch(e.target.value)} />
              </div>
              <Select value={brokerFilterStatus} onValueChange={setBrokerFilterStatus}>
                <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : filteredBrokerLeads.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow">
                <Star className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500">No referral partners yet. Sync your Google Sheet to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBrokerLeads.map(lead => <BrokerLeadCard key={lead.id} lead={lead} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Outreach Lead Dialog */}
      <Dialog open={isAddOpen || !!editingLead} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditingLead(null); } }}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Broker'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              <Input placeholder="Company" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
            </div>
            <Input type="email" placeholder="Email *" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'current_client').map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Channel</label>
                <Select value={form.outreach_channel} onValueChange={v => setForm({...form, outreach_channel: v})}>
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
                <Input type="date" value={form.last_contacted_date} onChange={e => setForm({...form, last_contacted_date: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Next Follow-up</label>
                <Input type="date" value={form.next_followup_date} onChange={e => setForm({...form, next_followup_date: e.target.value})} />
              </div>
            </div>
            <Input placeholder="Source" value={form.source} onChange={e => setForm({...form, source: e.target.value})} />
            <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} />
            <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              {editingLead ? 'Save Changes' : 'Add Broker'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Active Partners Quick-Pick Modal */}
      <Dialog open={showActivePartnersModal} onOpenChange={setShowActivePartnersModal}>
        <DialogContent className="max-w-md w-[95vw] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Handshake className="w-5 h-5" /> Active Referral Partners
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

      {/* Broker Lead Detail Modal */}
      {viewingBrokerLead && (
        <BrokerLeadDetail
          lead={viewingBrokerLead}
          onClose={() => setViewingBrokerLead(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            // Keep modal open but refresh local lead data via the list refetch
          }}
        />
      )}

      {/* Broker Lead (Referral Partner) Dialog */}
      <Dialog open={isAddBrokerOpen || !!editingBrokerLead} onOpenChange={(open) => { if (!open) { setIsAddBrokerOpen(false); setEditingBrokerLead(null); } }}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBrokerLead ? 'Edit Referral Partner' : 'Add Referral Partner'}</DialogTitle></DialogHeader>
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
              {editingBrokerLead ? 'Save Changes' : 'Add Partner'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}