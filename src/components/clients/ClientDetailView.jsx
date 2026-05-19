import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, Building, Mail, Phone, Globe, MapPin, DollarSign, Users, Calendar,
  Plus, Pencil, Trash2, FileText, MessageSquare, PhoneCall, Video, StickyNote,
  ChevronRight, Clock, CheckCircle, XCircle, Eye, Send, Package, Award, ListTodo,
  Upload, ExternalLink, X, RefreshCw, FolderOpen, Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TaskList from '@/components/tasks/TaskList';
import GmailHistory from '@/components/clients/GmailHistory';
import { productCatalog } from '@/components/curriculum/catalogData';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import FollowUpSettings from '@/components/clients/FollowUpSettings';
import BrokersEditor from '@/components/clients/BrokersEditor';
import AddContactDialog from '@/components/clients/AddContactDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const interactionIcons = {
  call: PhoneCall,
  email: Mail,
  meeting: Video,
  note: StickyNote
};

export default function ClientDetailView({ client: initialClient, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', title: '', notes: '' });
  const [interactionForm, setInteractionForm] = useState({
    interaction_type: 'call',
    date: new Date().toISOString().slice(0, 16),
    subject: '',
    notes: '',
    outcome: '',
    follow_up_date: '',
    proposal_id: ''
  });
  const [viewingProposal, setViewingProposal] = useState(null);
  const [showAddService, setShowAddService] = useState(false);
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentForm, setDocumentForm] = useState({ name: '', description: '' });
  const [resourceForm, setResourceForm] = useState({ title: '', url: '', resource_type: 'recording', session_name: '' });
  const [showAddResource, setShowAddResource] = useState(false);
  const [syncingResources, setSyncingResources] = useState(false);

  const queryClient = useQueryClient();

  // Fetch fresh client data to ensure we have latest invoice_ids
  const { data: freshClient } = useQuery({
    queryKey: ['client', initialClient.id],
    queryFn: async () => {
      const clients = await base44.entities.Client.filter({ id: initialClient.id });
      return clients[0] || initialClient;
    },
    initialData: initialClient
  });

  const client = freshClient;

  const startEditing = () => {
    setEditForm({
      name: client.name || '',
      email: client.email || '',
      title: client.title || '',
      phone: client.phone || '',
      company: client.company || '',
      industry: client.industry || '',
      company_size: client.company_size || '',
      company_address: client.company_address || '',
      company_website: client.company_website || '',
      wellness_budget: client.wellness_budget || '',
      plan_year_start: client.plan_year_start || '',
      wellness_fund_size: client.wellness_fund_size || '',
      brokers: client.brokers?.length > 0
        ? client.brokers
        : (client.broker_name ? [{ name: client.broker_name, email: client.broker_email || '', company: '', phone: '', notes: '' }] : []),
      wellness_consultant_name: client.wellness_consultant_name || '',
      wellness_consultant_email: client.wellness_consultant_email || '',
      referral_partner_id: client.referral_partner_id || '',
      referral_partner_name: client.referral_partner_name || '',
      notes: client.notes || '',
    });
    setIsEditing(true);
  };

  const saveEdits = () => {
    const data = { ...editForm };
    if (data.wellness_budget === '') delete data.wellness_budget;
    if (data.wellness_fund_size === '') delete data.wellness_fund_size;
    if (data.plan_year_start === '') delete data.plan_year_start;
    onUpdate(data);
    setIsEditing(false);
  };

  // Initialize selected templates when client data loads
  React.useEffect(() => {
    if (client?.portal_template_ids) {
      setSelectedTemplateIds(client.portal_template_ids);
    }
  }, [client?.id]);

  const { data: allServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  const { data: referralPartners = [] } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.filter({ is_active: true }, 'name')
  });

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery({
    queryKey: ['proposals', client.id],
    queryFn: async () => {
      const all = await base44.entities.Proposal.list('-created_date');
      return all.filter(p => p.client_id === client.id);
    },
    refetchOnMount: true
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions', client.id],
    queryFn: () => base44.entities.ClientInteraction.filter({ client_id: client.id }, '-date')
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date')
  });

  const { data: gmailEmailCount = 0, isLoading: gmailLoading } = useQuery({
    queryKey: ['gmailHistory', client.email],
    queryFn: async () => {
      const res = await base44.functions.invoke('syncGmailEmails', { clientEmail: client.email });
      return res.data;
    },
    select: (data) => {
      if (typeof data === 'number') return data;
      return data?.emails?.length || 0;
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list('-created_date')
  });

  const clientInvoices = allInvoices.filter(inv => 
    client.invoice_ids?.includes(inv.id) || 
    inv.client_email?.toLowerCase() === client.email?.toLowerCase()
  );

  const createInteractionMutation = useMutation({
    mutationFn: (data) => base44.entities.ClientInteraction.create({ ...data, client_id: client.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions', client.id] });
      setShowAddInteraction(false);
      setInteractionForm({ interaction_type: 'call', date: new Date().toISOString().slice(0, 16), subject: '', notes: '', outcome: '', follow_up_date: '', proposal_id: '' });
      // Update last_contacted
      onUpdate({ last_contacted: new Date().toISOString() });
    }
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: (id) => base44.entities.ClientInteraction.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interactions', client.id] })
  });

  const handleAddContact = () => {
    const contacts = [...(client.related_contacts || [])];
    if (editingContact !== null) {
      contacts[editingContact] = contactForm;
    } else {
      contacts.push(contactForm);
    }
    onUpdate({ related_contacts: contacts });
    setShowAddContact(false);
    setEditingContact(null);
    setContactForm({ name: '', email: '', phone: '', title: '', notes: '' });
  };

  const handleDeleteContact = (index) => {
    const contacts = [...(client.related_contacts || [])];
    contacts.splice(index, 1);
    onUpdate({ related_contacts: contacts });
  };

  const openEditContact = (contact, index) => {
    setContactForm(contact);
    setEditingContact(index);
    setShowAddContact(true);
  };

  const getServiceName = (serviceId) => {
    for (const category of Object.values(productCatalog)) {
      if (category[serviceId]) return category[serviceId].name;
    }
    return serviceId;
  };

  // Calculate totals
  const totalProposalValue = proposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const acceptedValue = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const paidInvoiceValue = clientInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const wonValue = acceptedValue + paidInvoiceValue;

  // Extract all purchased services/products from accepted proposals
  const getPurchasedServices = () => {
    const categoryMap = {
      workshops: 'Workshops',
      challengePrograms: '14-Day Challenges',
      leadership: 'Leadership',
      movementClasses: 'Classes'
    };
    const dataKeyMap = {
      workshops: 'workshopsData',
      challengePrograms: 'challengeProgramsData',
      leadership: 'leadershipData',
      movementClasses: 'movementClassesData'
    };

    const byCategory = {};
    const seenIds = new Set();

    proposals.filter(p => p.status === 'accepted').forEach(proposal => {
      const sel = proposal.selections || {};
      Object.entries(categoryMap).forEach(([selKey, label]) => {
        (sel[selKey] || []).forEach(id => {
          if (seenIds.has(id)) return;
          seenIds.add(id);
          const enriched = (sel[dataKeyMap[selKey]] || []).find(s => s.id === id);
          const dbService = allServices.find(s => s.id === id);
          const name = enriched?.name || dbService?.name || getServiceName(id);
          if (!byCategory[label]) byCategory[label] = [];
          byCategory[label].push({ id, name });
        });
      });

      // Wellness boxes
      const boxes = sel.sampleBoxQuantities || {};
      const boxNames = {
        reduceStress: 'Reduce Stress Box', relaxationSleep: 'Relaxation & Sleep Box',
        largeEmotional: 'Large Emotional Wellness Box', largeStressReduction: 'Large Stress Reduction Box',
        stressReductionDigital: 'Stress Reduction Digital Box', beyondBurnoutDigital: 'Beyond Burnout Digital Box',
        emotionalWellness: 'Emotional Wellness Box', wintertimeHealthy: 'Wintertime Stay Healthy Box',
        newYearFreshStart: 'New Year Fresh Start Box'
      };
      Object.entries(boxes).forEach(([key, qty]) => {
        if ((qty || 0) > 0 && boxNames[key]) {
          if (!byCategory['Wellness Boxes']) byCategory['Wellness Boxes'] = [];
          if (!byCategory['Wellness Boxes'].find(b => b.id === key)) {
            byCategory['Wellness Boxes'].push({ id: key, name: `${boxNames[key]} (×${qty})` });
          }
        }
      });
    });

    return byCategory;
  };

  // For legacy compat (add service dialog)
  const getClientServices = () => {
    const manualServices = allServices.filter(service => (client.purchased_services || []).includes(service.id));
    return Array.from(new Map(manualServices.map(s => [s.id, s])).values());
  };

  const purchasedByCategory = getPurchasedServices();
  const hasPurchasedServices = Object.keys(purchasedByCategory).length > 0;
  const clientServices = getClientServices();

  const removeService = (serviceId) => {
    const updated = (client.purchased_services || []).filter(id => id !== serviceId);
    onUpdate({ purchased_services: updated });
  };

  const addService = () => {
    if (!serviceToAdd) return;
    const updated = [...new Set([...(client.purchased_services || []), serviceToAdd])];
    onUpdate({ purchased_services: updated });
    setServiceToAdd('');
    setShowAddService(false);
  };

  return (
    <div className="space-y-6 overflow-y-auto flex-1 p-6 pt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 pr-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 flex-wrap" style={{ color: '#264d44' }}>
            <Building className="w-5 h-5 flex-shrink-0" />
            <span className="break-words">{client.company || client.name}</span>
          </h2>
          <p className="text-sm sm:text-base text-gray-600 flex items-center gap-1 mt-1 flex-wrap">
            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="font-medium">{client.name}</span>
            {client.title && <span className="text-gray-400">· {client.title}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {isEditing ? (
            <>
              <Button size="sm" onClick={saveEdits} className="bg-[#264d44] hover:bg-[#1a3830]">Save</Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Edit</span>
              </Button>
              <Link to={createPageUrl('EditProposal') + `?clientId=${client.id}`}>
                <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132] whitespace-nowrap">
                  <FileText className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">New Proposal</span><span className="sm:hidden">Proposal</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Proposals</p>
          <p className="text-xl sm:text-2xl font-bold" style={{ color: '#013f7c' }}>{proposals.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Proposal Value</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">${totalProposalValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Won Value</p>
          <p className="text-xl sm:text-2xl font-bold" style={{ color: '#770142' }}>${wonValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Interactions</p>
          <div className="flex items-center gap-1">
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{interactions.length + gmailEmailCount}</p>
            {gmailLoading && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />}
          </div>
          {gmailEmailCount > 0 && (
            <p className="text-xs text-gray-400">{interactions.length} logged + {gmailEmailCount} emails</p>
          )}
        </div>
      </div>
      
      {/* QuickBooks Invoice Stats */}
      {(client.total_invoice_value > 0 || client.invoice_count > 0) && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">QuickBooks Invoice Total</p>
              <p className="text-3xl font-bold text-green-700">${(client.total_invoice_value || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">{client.invoice_count || 0} invoice{client.invoice_count !== 1 ? 's' : ''} synced from QuickBooks</p>
            </div>
            <div className="text-green-600">
              <DollarSign className="w-12 h-12" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto h-auto flex-wrap gap-1 justify-start bg-muted p-1 rounded-lg">
          <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
          <TabsTrigger value="contacts" className="flex-shrink-0">Contacts ({(client.related_contacts?.length || 0) + 1})</TabsTrigger>
          <TabsTrigger value="proposals" className="flex-shrink-0">Proposals ({proposals.length})</TabsTrigger>
          <TabsTrigger value="invoices" className="flex-shrink-0">Invoices ({clientInvoices.length})</TabsTrigger>
          <TabsTrigger value="interactions" className="flex-shrink-0">Activity ({interactions.length})</TabsTrigger>
          <TabsTrigger value="tasks" className="flex-shrink-0">Tasks</TabsTrigger>
          <TabsTrigger value="emails" className="flex-shrink-0">Emails</TabsTrigger>
          <TabsTrigger value="portal" className="flex-shrink-0">Portal Docs</TabsTrigger>
          <TabsTrigger value="followup" className="flex-shrink-0">Follow-Up</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {isEditing ? (
            <div className="bg-gray-50 rounded-xl p-5 space-y-4 border">
              <h4 className="font-semibold text-gray-700">Edit Client Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 mb-1 block font-semibold">Company Name</label><Input value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} placeholder="Company / Organization" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Contact Name *</label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Job Title</label><Input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Contact Email *</label><Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Industry</label><Input value={editForm.industry} onChange={e => setEditForm({...editForm, industry: e.target.value})} /></div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Company Size</label>
                  <Select value={editForm.company_size || 'none'} onValueChange={v => setEditForm({...editForm, company_size: v === 'none' ? '' : v})}>
                    <SelectTrigger><SelectValue placeholder="Select size..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select size...</SelectItem>
                      {['1-50','51-200','201-500','501-1000','1001-5000','5000+'].map(s => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 mb-1 block">Company Website</label><Input value={editForm.company_website} onChange={e => setEditForm({...editForm, company_website: e.target.value})} /></div>
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 mb-1 block">Company Address</label><Input value={editForm.company_address} onChange={e => setEditForm({...editForm, company_address: e.target.value})} /></div>
              </div>
              <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Wellness Budget ($)</label><Input type="number" value={editForm.wellness_budget} onChange={e => setEditForm({...editForm, wellness_budget: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Plan Year Start</label><Input type="date" value={editForm.plan_year_start} onChange={e => setEditForm({...editForm, plan_year_start: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Fund Size / Employee ($)</label><Input type="number" value={editForm.wellness_fund_size} onChange={e => setEditForm({...editForm, wellness_fund_size: e.target.value})} /></div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Broker(s)</p>
                <BrokersEditor
                  brokers={editForm.brokers || []}
                  onChange={(brokers) => setEditForm({ ...editForm, brokers })}
                />
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Wellness Consultant</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Consultant Name</label><Input value={editForm.wellness_consultant_name} onChange={e => setEditForm({...editForm, wellness_consultant_name: e.target.value})} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Consultant Email</label><Input type="email" value={editForm.wellness_consultant_email} onChange={e => setEditForm({...editForm, wellness_consultant_email: e.target.value})} /></div>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Referral Partner</p>
                <Select value={editForm.referral_partner_id || 'none'} onValueChange={v => {
                  const partner = referralPartners.find(p => p.id === v);
                  setEditForm({ ...editForm, referral_partner_id: v === 'none' ? '' : v, referral_partner_name: partner?.name || '' });
                }}>
                  <SelectTrigger><SelectValue placeholder="No referral partner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No referral partner</SelectItem>
                    {referralPartners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-3">
                <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                <Textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={3} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={saveEdits} className="bg-[#264d44] hover:bg-[#1a3830]">Save Changes</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
          <>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700">Contact Information</h4>
              <p className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-400" /> {client.email}</p>
              {client.phone && <p className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" /> {client.phone}</p>}
              {client.company_website && (
                <a href={client.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Globe className="w-4 h-4" /> {client.company_website}
                </a>
              )}
              {client.company_address && <p className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-gray-400" /> {client.company_address}</p>}
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700">Company Details</h4>
              {client.industry && <p className="text-sm"><Badge variant="outline">{client.industry}</Badge></p>}
              {client.company_size && <p className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-gray-400" /> {client.company_size} employees</p>}
              {client.wellness_budget && <p className="flex items-center gap-2 text-sm text-green-600"><DollarSign className="w-4 h-4" /> ${client.wellness_budget.toLocaleString()} wellness budget</p>}
              {client.plan_year_start && <p className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-gray-400" /> Plan year starts: {new Date(client.plan_year_start).toLocaleDateString()}</p>}
              {client.wellness_fund_size && <p className="flex items-center gap-2 text-sm text-green-600"><DollarSign className="w-4 h-4" /> ${client.wellness_fund_size.toLocaleString()} / employee fund</p>}
              {client.last_contacted && <p className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-gray-400" /> Last contact: {new Date(client.last_contacted).toLocaleDateString()}</p>}
              {(client.total_invoice_value > 0 || client.invoice_count > 0) && (
                <>
                  <p className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                    <DollarSign className="w-4 h-4" /> ${(client.total_invoice_value || 0).toLocaleString()} invoiced (QB)
                  </p>
                  <p className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4 text-gray-400" /> {client.invoice_count || 0} invoice{client.invoice_count !== 1 ? 's' : ''}
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* Referral Partner */}
          {client.referral_partner_name && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-gray-700 mb-1 text-sm uppercase tracking-wide text-green-800">Referred By</h4>
              <p className="text-sm font-medium text-green-900">{client.referral_partner_name}</p>
            </div>
          )}

          {/* Broker(s) & Consultant Info */}
          {(() => {
            const activeBrokers = client.brokers?.length > 0
              ? client.brokers
              : (client.broker_name ? [{ name: client.broker_name, email: client.broker_email }] : []);
            const hasConsultant = client.wellness_consultant_name || client.wellness_consultant_email;
            if (!activeBrokers.length && !hasConsultant) return null;
            return (
              <div className="space-y-3 mt-4">
                {activeBrokers.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-3">
                      Broker{activeBrokers.length > 1 ? 's' : ''}
                    </h4>
                    <div className="space-y-3">
                      {activeBrokers.map((broker, i) => (
                        <div key={i} className={activeBrokers.length > 1 ? 'border-b border-blue-200 pb-3 last:border-0 last:pb-0' : ''}>
                          {broker.name && <p className="text-sm font-medium">{broker.name}</p>}
                          {broker.company && <p className="text-sm text-gray-500">{broker.company}</p>}
                          {broker.email && <p className="flex items-center gap-2 text-sm text-blue-600"><Mail className="w-4 h-4" /> {broker.email}</p>}
                          {broker.phone && <p className="text-sm text-gray-500">{broker.phone}</p>}
                          {broker.notes && <p className="text-xs text-gray-400 italic mt-1">{broker.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasConsultant && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Wellness Consultant</h4>
                    {client.wellness_consultant_name && <p className="text-sm font-medium">{client.wellness_consultant_name}</p>}
                    {client.wellness_consultant_email && <p className="flex items-center gap-2 text-sm text-purple-600"><Mail className="w-4 h-4" /> {client.wellness_consultant_email}</p>}
                  </div>
                )}
              </div>
            );
          })()}
          
          {client.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-700 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
          </>
          )}

          {/* Purchased Services Section */}
          {!isEditing && <div className="rounded-lg border p-4 bg-emerald-50 border-emerald-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                Purchased Services & Products
              </h4>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddService(true)}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {hasPurchasedServices ? (
              <div className="space-y-3">
                {Object.entries(purchasedByCategory).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">{category}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(item => (
                        <Badge key={item.id} className="bg-white text-emerald-800 border border-emerald-300">
                          {item.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Manually added services */}
                {clientServices.filter(s => (client.purchased_services || []).includes(s.id)).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Manually Added</p>
                    <div className="flex flex-wrap gap-2">
                      {clientServices.filter(s => (client.purchased_services || []).includes(s.id)).map(service => (
                        <Badge key={service.id} className="bg-white text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          {service.name}
                          <button onClick={() => removeService(service.id)} className="ml-1 hover:text-red-600">×</button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No services from accepted proposals yet</p>
            )}
          </div>}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-700">All Contacts</h4>
            <Button size="sm" variant="outline" onClick={() => { setEditingContact(null); setShowAddContact(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Contact
            </Button>
          </div>
          
          <div className="space-y-3">
            {/* Primary Contact */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <Badge className="bg-blue-100 text-blue-700 mb-2">Primary Contact</Badge>
                  <p className="font-semibold">{client.name}</p>
                  {client.title && <p className="text-sm text-gray-600">{client.title}</p>}
                  <p className="text-sm text-gray-500">{client.email}</p>
                  {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
                </div>
              </div>
            </div>

            {/* Brokers */}
            {(() => {
              const activeBrokers = client.brokers?.length > 0
                ? client.brokers
                : (client.broker_name ? [{ name: client.broker_name, email: client.broker_email }] : []);
              return activeBrokers.map((broker, i) => (
                <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div>
                    <Badge className="bg-orange-100 text-orange-700 mb-2">Broker{activeBrokers.length > 1 ? ` ${i + 1}` : ''}</Badge>
                    {broker.name && <p className="font-semibold">{broker.name}</p>}
                    {broker.company && <p className="text-sm text-gray-600">{broker.company}</p>}
                    {broker.email && <p className="text-sm text-gray-500">{broker.email}</p>}
                    {broker.phone && <p className="text-sm text-gray-500">{broker.phone}</p>}
                    {broker.notes && <p className="text-xs text-gray-400 italic mt-1">{broker.notes}</p>}
                  </div>
                </div>
              ));
            })()}

            {/* Wellness Consultant */}
            {(client.wellness_consultant_name || client.wellness_consultant_email) && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-purple-100 text-purple-700 mb-2">Wellness Consultant</Badge>
                    {client.wellness_consultant_name && <p className="font-semibold">{client.wellness_consultant_name}</p>}
                    {client.company && <p className="text-sm text-gray-600">{client.company}</p>}
                    {client.wellness_consultant_email && <p className="text-sm text-gray-500">{client.wellness_consultant_email}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Related Contacts */}
            {(client.related_contacts || []).map((contact, index) => {
              const typeColors = {
                broker: 'bg-orange-100 text-orange-700',
                wellness_consultant: 'bg-purple-100 text-purple-700',
                other: 'bg-gray-100 text-gray-700',
              };
              const typeLabel = {
                broker: 'Broker',
                wellness_consultant: 'Wellness Consultant',
                other: 'Other',
              };
              return (
              <div key={index} className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    {contact.contact_type && contact.contact_type !== 'other' && (
                      <Badge className={`${typeColors[contact.contact_type] || typeColors.other} mb-2`}>
                        {typeLabel[contact.contact_type] || contact.contact_type}
                      </Badge>
                    )}
                    <p className="font-semibold">{contact.name}</p>
                    {contact.title && <p className="text-sm text-gray-600">{contact.title}</p>}
                    {contact.company && <p className="text-sm text-gray-500">{contact.company}</p>}
                    {contact.email && <p className="text-sm text-gray-500">{contact.email}</p>}
                    {contact.phone && <p className="text-sm text-gray-500">{contact.phone}</p>}
                    {contact.linked_partner_id && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> Linked referral partner
                      </p>
                    )}
                    {contact.notes && <p className="text-sm text-gray-400 mt-1">{contact.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditContact(contact, index)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDeleteContact(index)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="mt-4">
          {proposalsLoading ? (
            <p className="text-center text-gray-500 py-8">Loading proposals...</p>
          ) : (
            <>
              {/* Activity Timeline */}
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                <h4 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Recent Activity
                </h4>
                <div className="space-y-2">
                  {proposals.slice(0, 5).map(proposal => {
                    const status = statusConfig[proposal.status || 'draft'];
                    const StatusIcon = status.icon;
                    const latestDate = proposal.viewed_date || proposal.sent_date || proposal.created_date;
                    const latestAction = proposal.viewed_date ? 'Viewed' : proposal.sent_date ? 'Sent' : 'Created';

                    return (
                      <div key={proposal.id} className="flex items-center gap-3 text-sm bg-white rounded-lg p-2 border">
                        <StatusIcon className={`w-4 h-4 ${status.color.split(' ')[1]}`} />
                        <div className="flex-1">
                          <span className="font-medium">${proposal.total_amount?.toLocaleString()}</span>
                          <span className="text-gray-500 mx-2">•</span>
                          <span className="text-gray-600">{latestAction}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(latestDate).toLocaleDateString()}
                        </span>
                        <Badge className={`${status.color} text-xs`}>
                          {status.label}
                        </Badge>
                      </div>
                    );
                  })}
                  {proposals.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">No activity yet</p>
                  )}
                </div>
              </div>

              {/* All Proposals */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700">All Proposals ({proposals.length})</h4>
                {proposals.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No proposals yet</p>
                ) : (
                proposals.map(proposal => {
                  const status = statusConfig[proposal.status || 'draft'];
                  const StatusIcon = status.icon;
                  return (
                    <div key={proposal.id} className="bg-white border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-lg">${proposal.total_amount?.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">
                            Created: {new Date(proposal.created_date).toLocaleDateString()}
                            {proposal.sent_date && ` • Sent: ${new Date(proposal.sent_date).toLocaleDateString()}`}
                          </p>
                          {proposal.narrative_summary && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{proposal.narrative_summary}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => setViewingProposal(proposal)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Link to={createPageUrl('EditProposal') + `?id=${proposal.id}`}>
                            <Button size="sm" variant="outline"><Pencil className="w-4 h-4" /></Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <div className="space-y-3">
            {clientInvoices.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No invoices yet</p>
            ) : (
              clientInvoices.map(invoice => {
                const statusColors = {
                  draft: 'bg-gray-100 text-gray-700',
                  sent: 'bg-blue-100 text-blue-700',
                  paid: 'bg-green-100 text-green-700',
                  overdue: 'bg-red-100 text-red-700',
                  cancelled: 'bg-gray-100 text-gray-500'
                };
                return (
                  <div key={invoice.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingInvoice(invoice)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-lg">{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}</p>
                          <Badge className={statusColors[invoice.status || 'draft']}>
                            {invoice.status || 'draft'}
                          </Badge>
                          {invoice.quickbooks_id && (
                            <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                              QB Synced
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Issue: {new Date(invoice.issue_date).toLocaleDateString()}
                          {' • '}
                          Due: {new Date(invoice.due_date).toLocaleDateString()}
                          {invoice.paid_date && ` • Paid: ${new Date(invoice.paid_date).toLocaleDateString()}`}
                        </p>
                        {invoice.memo && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">{invoice.memo}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: '#770142' }}>
                          ${invoice.total_amount?.toLocaleString()}
                        </p>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setViewingInvoice(invoice); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-700">Activity Log</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddInteraction(true)}>
              <Plus className="w-4 h-4 mr-1" /> Log Interaction
            </Button>
          </div>

          <div className="space-y-3">
            {interactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No interactions logged yet</p>
            ) : (
              interactions.map(interaction => {
                const Icon = interactionIcons[interaction.interaction_type] || MessageSquare;
                const linkedProposal = proposals.find(p => p.id === interaction.proposal_id);
                return (
                  <div key={interaction.id} className="bg-white border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold capitalize">{interaction.interaction_type}</p>
                            {interaction.subject && <span className="text-gray-500">- {interaction.subject}</span>}
                          </div>
                          <p className="text-sm text-gray-500">{new Date(interaction.date).toLocaleString()}</p>
                          {interaction.notes && <p className="text-sm text-gray-600 mt-1">{interaction.notes}</p>}
                          {interaction.outcome && <p className="text-sm text-green-600 mt-1"><strong>Outcome:</strong> {interaction.outcome}</p>}
                          {interaction.follow_up_date && (
                            <p className="text-sm text-amber-600 mt-1"><Calendar className="w-3 h-3 inline mr-1" /> Follow-up: {new Date(interaction.follow_up_date).toLocaleDateString()}</p>
                          )}
                          {linkedProposal && (
                            <Badge variant="outline" className="mt-2">
                              <FileText className="w-3 h-3 mr-1" /> ${linkedProposal.total_amount?.toLocaleString()} proposal
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteInteractionMutation.mutate(interaction.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="mt-4">
          <GmailHistory clientEmail={client.email} />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <div className="bg-white border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                <ListTodo className="w-5 h-5" />
                Client Tasks
              </h4>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  if (!confirm('Mark all tasks as complete for this client?')) return;
                  try {
                    const allTasks = await base44.entities.ClientTask.filter({ client_id: client.id });
                    const pendingTasks = allTasks.filter(t => t.status !== 'completed');
                    
                    for (const task of pendingTasks) {
                      await base44.entities.ClientTask.update(task.id, {
                        status: 'completed',
                        completed_date: new Date().toISOString()
                      });
                    }
                    
                    queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
                    alert(`${pendingTasks.length} task(s) marked as complete!`);
                  } catch (error) {
                    alert('Failed to complete tasks: ' + error.message);
                  }
                }}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                All Tasks Complete
              </Button>
            </div>
            <TaskList clientId={client.id} showProposalGroups={true} />
          </div>
        </TabsContent>

        {/* Follow-Up Tab */}
        <TabsContent value="followup" className="mt-4">
          <FollowUpSettings client={client} onUpdate={onUpdate} />
        </TabsContent>

        {/* Portal Tab */}
        <TabsContent value="portal" className="mt-4 space-y-6">
          {/* Templates Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Email Template Access</h4>
                  <p className="text-sm text-blue-700">
                    To assign email templates to this client's portal, go to <strong>Templates</strong> page and use the "Assign to Portals" button on any template.
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
                    {client.portal_template_ids?.length || 0} template(s) currently assigned to this portal
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Custom Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload custom documents that will be available in this client's portal.
              </p>

              {/* Existing Documents */}
              <div className="space-y-2">
                {(client.portal_documents || []).map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{doc.name}</p>
                      {doc.description && (
                        <p className="text-xs text-gray-500">{doc.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Uploaded: {new Date(doc.uploaded_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-red-500"
                        onClick={async () => {
                          const updated = (client.portal_documents || []).filter((_, i) => i !== index);
                          await onUpdate({ portal_documents: updated });
                          queryClient.invalidateQueries({ queryKey: ['client', client.id] });
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Form */}
              <div className="border-t pt-4">
                <h5 className="font-medium text-sm mb-3">Upload New Document</h5>
                <div className="space-y-3">
                  <Input 
                    placeholder="Document name *" 
                    value={documentForm.name}
                    onChange={(e) => setDocumentForm({...documentForm, name: e.target.value})}
                  />
                  <Input 
                    placeholder="Description (optional)" 
                    value={documentForm.description}
                    onChange={(e) => setDocumentForm({...documentForm, description: e.target.value})}
                  />
                  <div>
                    <Input 
                      type="file"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !documentForm.name) {
                          alert('Please enter a document name first');
                          return;
                        }
                        
                        setUploadingDocument(true);
                        try {
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          const newDoc = {
                            name: documentForm.name,
                            description: documentForm.description,
                            file_url,
                            uploaded_date: new Date().toISOString()
                          };
                          const updated = [...(client.portal_documents || []), newDoc];
                          await onUpdate({ portal_documents: updated });
                          queryClient.invalidateQueries({ queryKey: ['client', client.id] });
                          setDocumentForm({ name: '', description: '' });
                          e.target.value = '';
                        } catch (error) {
                          alert('Failed to upload file: ' + error.message);
                        } finally {
                          setUploadingDocument(false);
                        }
                      }}
                      disabled={uploadingDocument || !documentForm.name}
                    />
                    {uploadingDocument && (
                      <p className="text-sm text-blue-600 mt-2">Uploading...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Session Resources */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="font-medium text-sm flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Session Resources</h5>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-[#264d44] text-[#264d44] hover:bg-[#264d44] hover:text-white"
                      disabled={syncingResources}
                      onClick={async () => {
                        setSyncingResources(true);
                        try {
                          const res = await base44.functions.invoke('syncServiceResourcesToClient', { client_id: client.id });
                          const d = res.data;
                          if (d.skipped) {
                            toast.info(d.reason || 'Nothing to sync');
                          } else {
                            toast.success(`Added ${d.added} resource(s) from ${d.services_synced?.join(', ')}`);
                            queryClient.invalidateQueries({ queryKey: ['client', client.id] });
                          }
                        } catch (err) {
                          toast.error('Sync failed: ' + err.message);
                        } finally {
                          setSyncingResources(false);
                        }
                      }}
                    >
                      {syncingResources ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Sync from Services
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddResource(!showAddResource)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Resource
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">Resources from purchased services sync automatically. You can also manually add links to recordings, presentations, and handouts.</p>

                {/* Existing Resources */}
                <div className="space-y-2 mb-3">
                  {(client.session_resources || []).map((resource, index) => {
                    const typeColors = { recording: 'bg-red-50 border-red-200', presentation: 'bg-blue-50 border-blue-200', handout: 'bg-green-50 border-green-200', other: 'bg-gray-50 border-gray-200' };
                    const typeBadge = { recording: 'bg-red-100 text-red-700', presentation: 'bg-blue-100 text-blue-700', handout: 'bg-green-100 text-green-700', other: 'bg-gray-100 text-gray-700' };
                    return (
                      <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${typeColors[resource.resource_type] || typeColors.other}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{resource.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${typeBadge[resource.resource_type] || typeBadge.other}`}>{resource.resource_type}</span>
                          </div>
                          {resource.session_name && <p className="text-xs text-gray-500 mt-0.5">{resource.session_name}</p>}
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(resource.url, '_blank')}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={async () => {
                            const updated = (client.session_resources || []).filter((_, i) => i !== index);
                            await onUpdate({ session_resources: updated });
                            queryClient.invalidateQueries({ queryKey: ['client', client.id] });
                          }}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(client.session_resources || []).length === 0 && !showAddResource && (
                    <p className="text-xs text-gray-400 italic">No resources added yet.</p>
                  )}
                </div>

                {/* Add Resource Form */}
                {showAddResource && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 border">
                    <Input placeholder="Title (e.g. Stress Workshop Recording)" value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} />
                    <Input placeholder="URL / Link" value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} />
                    <Input placeholder="Session name (optional, e.g. March Workshop)" value={resourceForm.session_name} onChange={(e) => setResourceForm({ ...resourceForm, session_name: e.target.value })} />
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                      value={resourceForm.resource_type}
                      onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                    >
                      <option value="recording">🎥 Recording</option>
                      <option value="presentation">📊 Presentation (PPT)</option>
                      <option value="handout">📄 Handout</option>
                      <option value="other">📁 Other</option>
                    </select>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-[#264d44] hover:bg-[#1a3830]" disabled={!resourceForm.title || !resourceForm.url} onClick={async () => {
                        const newResource = { ...resourceForm, added_date: new Date().toISOString() };
                        const updated = [...(client.session_resources || []), newResource];
                        await onUpdate({ session_resources: updated });
                        queryClient.invalidateQueries({ queryKey: ['client', client.id] });
                        setResourceForm({ title: '', url: '', resource_type: 'recording', session_name: '' });
                        setShowAddResource(false);
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddResource(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Portal Link */}
              <div className="border-t pt-4">
                <h5 className="font-medium text-sm mb-2">Client Portal Access</h5>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}${createPageUrl('ClientPortal')}?clientId=${client.id}`}
                    className="text-xs"
                  />
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${createPageUrl('ClientPortal')}?clientId=${client.id}`);
                      alert('Portal link copied to clipboard!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContact && editingContact === null}
        onOpenChange={setShowAddContact}
        client={client}
        onUpdate={onUpdate}
      />

      {/* Edit Contact Dialog (legacy simple form) */}
      <Dialog open={showAddContact && editingContact !== null} onOpenChange={(o) => { if (!o) { setShowAddContact(false); setEditingContact(null); } }}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Name *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
            <Input placeholder="Title" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} />
            <Input placeholder="Company" value={contactForm.company || ''} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} />
            <Input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
            <Textarea placeholder="Notes" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
            <Button onClick={handleAddContact} disabled={!contactForm.name} className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Proposal Dialog */}
      <Dialog open={!!viewingProposal} onOpenChange={(open) => !open && setViewingProposal(null)}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposal Details</DialogTitle>
          </DialogHeader>
          {viewingProposal && (
            <div className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#770142' }}>
                    ${viewingProposal.total_amount?.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(viewingProposal.created_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={statusConfig[viewingProposal.status || 'draft'].color}>
                  {statusConfig[viewingProposal.status || 'draft'].label}
                </Badge>
              </div>

              {viewingProposal.narrative_summary && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Program Overview</h4>
                  <p className="text-sm text-gray-600">{viewingProposal.narrative_summary}</p>
                </div>
              )}

              {(() => {
                const sel = viewingProposal.selections || {};
                const items = [];
                
                if (sel.workshops?.length > 0) {
                  items.push({ category: 'Workshops', services: sel.workshops, dataKey: 'workshopsData' });
                }
                if (sel.challengePrograms?.length > 0) {
                  items.push({ category: '14-Day Challenges', services: sel.challengePrograms, dataKey: 'challengeProgramsData' });
                }
                if (sel.leadership?.length > 0) {
                  items.push({ category: 'Leadership', services: sel.leadership, dataKey: 'leadershipData' });
                }
                if (sel.movementClasses?.length > 0) {
                  items.push({ category: 'Classes', services: sel.movementClasses, dataKey: 'movementClassesData' });
                }

                return items.map(({ category, services, dataKey }, idx) => (
                  <div key={idx} className="bg-white border rounded-lg p-4">
                    <h4 className="font-semibold mb-2" style={{ color: '#264d44' }}>{category}</h4>
                    <ul className="space-y-1">
                      {services.map(serviceId => {
                        // Try enriched data first, then DB services, then static catalog
                        const enriched = (sel[dataKey] || []).find(s => s.id === serviceId);
                        const dbService = allServices.find(s => s.id === serviceId);
                        const name = enriched?.name || dbService?.name || getServiceName(serviceId);
                        const desc = enriched?.description || dbService?.short_description || dbService?.description;
                        return (
                          <li key={serviceId} className="text-sm text-gray-600">
                            <span className="font-medium text-gray-800">• {name}</span>
                            {desc && <span className="block pl-4 text-xs text-gray-500 mt-0.5">{desc.slice(0, 120)}{desc.length > 120 ? '…' : ''}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ));
              })()}

              <Link to={createPageUrl('EditProposal') + `?id=${viewingProposal.id}`}>
                <Button className="w-full">
                  <Pencil className="w-4 h-4 mr-2" /> Edit Proposal
                </Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Service Dialog */}
      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Add Service to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Select value={serviceToAdd} onValueChange={setServiceToAdd}>
              <SelectTrigger><SelectValue placeholder="Select a service..." /></SelectTrigger>
              <SelectContent>
                {allServices.filter(s => s.is_active !== false && !clientServices.find(cs => cs.id === s.id)).map(service => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - ${service.price?.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addService} disabled={!serviceToAdd} className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              Add Service
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      {viewingInvoice && (
        <InvoiceDialog
          open={!!viewingInvoice}
          onOpenChange={(open) => !open && setViewingInvoice(null)}
          invoice={viewingInvoice}
          mode="view"
          clients={[client]}
        />
      )}

      {/* Add Interaction Dialog */}
      <Dialog open={showAddInteraction} onOpenChange={setShowAddInteraction}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Select value={interactionForm.interaction_type} onValueChange={(v) => setInteractionForm({ ...interactionForm, interaction_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">📞 Phone Call</SelectItem>
                <SelectItem value="email">✉️ Email</SelectItem>
                <SelectItem value="meeting">🎥 Meeting</SelectItem>
                <SelectItem value="note">📝 Note</SelectItem>
              </SelectContent>
            </Select>
            <Input type="datetime-local" value={interactionForm.date} onChange={(e) => setInteractionForm({ ...interactionForm, date: e.target.value })} />
            <Input placeholder="Subject" value={interactionForm.subject} onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })} />
            <Textarea placeholder="Notes / Details" value={interactionForm.notes} onChange={(e) => setInteractionForm({ ...interactionForm, notes: e.target.value })} rows={3} />
            <Input placeholder="Outcome / Next Steps" value={interactionForm.outcome} onChange={(e) => setInteractionForm({ ...interactionForm, outcome: e.target.value })} />
            <div>
              <label className="text-sm text-gray-600">Follow-up Date (optional)</label>
              <Input type="date" value={interactionForm.follow_up_date} onChange={(e) => setInteractionForm({ ...interactionForm, follow_up_date: e.target.value })} />
            </div>
            {proposals.length > 0 && (
              <Select value={interactionForm.proposal_id || "none"} onValueChange={(v) => setInteractionForm({ ...interactionForm, proposal_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Link to Proposal (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked proposal</SelectItem>
                  {proposals.map(p => (
                    <SelectItem key={p.id} value={p.id}>${p.total_amount?.toLocaleString()} - {new Date(p.created_date).toLocaleDateString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => createInteractionMutation.mutate(interactionForm)} className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              Log Interaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}