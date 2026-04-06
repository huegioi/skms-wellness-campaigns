import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Building, Mail, Phone, Pencil, Trash2, RefreshCw, UserCheck, MapPin, Linkedin, ExternalLink, User } from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

const EMPTY_FORM = {
  name: '', email: '', company: '', title: '', phone: '',
  industry: '', company_size: '', status: 'cold',
  outreach_channel: 'email', last_contacted_date: '',
  next_followup_date: '', notes: '', source: ''
};

function BrokerStats({ leads, clientEmails, filterStatus, setFilterStatus }) {
  const counts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key] = leads.filter(l => {
      const eff = clientEmails.has(l.email?.toLowerCase()) ? 'current_client' : l.status;
      return eff === key;
    }).length;
    return acc;
  }, {});

  const pieData = Object.entries(STATUS_CONFIG)
    .map(([key, cfg]) => ({ name: cfg.label, value: counts[key] || 0, key, color: cfg.chart }))
    .filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl shadow p-5 mb-5">
      <h2 className="text-base font-semibold text-gray-700 mb-4">Pipeline Overview</h2>
      <div className="flex flex-col md:flex-row gap-6 items-center">
        {/* Pie chart */}
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
        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
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
        {/* Total */}
        <div className="text-center flex-shrink-0">
          <p className="text-4xl font-bold text-[#013f7c]">{leads.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Brokers</p>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingLead, setEditingLead] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [syncing, setSyncing] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date')
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  // Build a set of client emails for duplicate detection
  const clientEmails = new Set(clients.map(c => c.email?.toLowerCase()).filter(Boolean));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setIsAddOpen(false); setForm(EMPTY_FORM); toast.success('Lead added'); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setEditingLead(null); toast.success('Lead updated'); }
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

    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (lead) => {
    setForm({
      name: lead.name || '', email: lead.email || '', company: lead.company || '',
      title: lead.title || '', phone: lead.phone || '', industry: lead.industry || '',
      company_size: lead.company_size || '', status: lead.status || 'cold',
      outreach_channel: lead.outreach_channel || 'email',
      last_contacted_date: lead.last_contacted_date || '',
      next_followup_date: lead.next_followup_date || '',
      notes: lead.notes || '', source: lead.source || ''
    });
    setEditingLead(lead);
  };

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

  const filtered = leads.filter(lead => {
    const matchSearch = !search ||
      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company?.toLowerCase().includes(search.toLowerCase());

    // Auto-flag current clients
    const effectiveStatus = clientEmails.has(lead.email?.toLowerCase()) ? 'current_client' : lead.status;
    const matchStatus = filterStatus === 'all' || effectiveStatus === filterStatus;

    return matchSearch && matchStatus;
  });

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key] = leads.filter(l => {
      const eff = clientEmails.has(l.email?.toLowerCase()) ? 'current_client' : l.status;
      return eff === key;
    }).length;
    return acc;
  }, {});

  const FormDialog = ({ open, onClose, title }) => (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
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
            <Input placeholder="Industry" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} />
            <Input placeholder="Company Size" value={form.company_size} onChange={e => setForm({...form, company_size: e.target.value})} />
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
          <Input placeholder="Source (e.g. LinkedIn, Referral)" value={form.source} onChange={e => setForm({...form, source: e.target.value})} />
          <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} />
          <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">
            {editingLead ? 'Save Changes' : 'Add Broker'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#013f7c]">Brokers</h1>
            <p className="text-sm text-gray-500 mt-0.5">{leads.length} total brokers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Sheet'}
            </Button>
            <Button className="bg-[#264d44] hover:bg-[#1a3830] gap-2" onClick={() => { setForm(EMPTY_FORM); setEditingLead(null); setIsAddOpen(true); }}>
              <Plus className="w-4 h-4" /> Add Broker
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">

        <BrokerStats leads={leads} clientEmails={clientEmails} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

        {/* Search + filter row */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search by name, email, company, or location..." className="pl-10 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
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

        {/* Lead list */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow">
            <p className="text-gray-500">No leads found. Add one or sync your Google Sheet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(lead => {
              const isCurrentClient = clientEmails.has(lead.email?.toLowerCase());
              const effectiveStatus = isCurrentClient ? 'current_client' : (lead.status || 'cold');
              const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.cold;

              // Parse source field: "Location | LinkedIn URL"
              const sourceParts = (lead.source || '').split(' | ');
              const location = sourceParts[0] || '';
              const linkedinUrl = sourceParts[1] || '';

              return (
                <div key={lead.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${isCurrentClient ? 'border-teal-500' : 'border-transparent'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Name + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{lead.name}</span>
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">Broker</Badge>
                        {isCurrentClient && <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-300 gap-1"><UserCheck className="w-3 h-3" /> In Client DB</Badge>}
                      </div>

                      {/* Row 2: Title + Company */}
                      {(lead.title || lead.company) && (
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                          {lead.title && <span className="flex items-center gap-1"><User className="w-3 h-3" />{lead.title}</span>}
                          {lead.company && <span className="flex items-center gap-1"><Building className="w-3 h-3" />{lead.company}</span>}
                        </div>
                      )}

                      {/* Row 3: Contact info */}
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

                      {/* Row 4: Channel, Industry, Dates */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {lead.outreach_channel && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{lead.outreach_channel}</span>
                        )}
                        {lead.industry && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{lead.industry}</span>
                        )}
                        {lead.last_contacted_date && <span className="text-xs text-gray-400">Last contacted: {new Date(lead.last_contacted_date).toLocaleDateString()}</span>}
                        {lead.next_followup_date && <span className="text-xs text-amber-600">Follow-up: {new Date(lead.next_followup_date).toLocaleDateString()}</span>}
                      </div>

                      {/* Row 5: Notes */}
                      {lead.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{lead.notes}</p>}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(lead)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(lead.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FormDialog open={isAddOpen} onClose={setIsAddOpen} title="Add New Broker" />
      <FormDialog open={!!editingLead} onClose={() => setEditingLead(null)} title="Edit Lead" />
    </div>
  );
}