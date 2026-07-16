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
  Upload, ExternalLink, X, RefreshCw, FolderOpen, Link as LinkIcon, Linkedin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TaskList from '@/components/tasks/TaskList';
import { productCatalog } from '@/components/curriculum/catalogData';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import FollowUpSettings from '@/components/clients/FollowUpSettings';
import BrokersEditor from '@/components/clients/BrokersEditor';
import AddContactDialog from '@/components/clients/AddContactDialog';
import PrimaryContactEditor from '@/components/clients/PrimaryContactEditor';
import ClientScheduleTab from '@/components/clients/ClientScheduleTab';
import { TagSelector } from '@/components/ui/TagSelector';
import TagManager from '@/components/ui/TagManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import MayaInsightsWidget from '@/components/shared/MayaInsightsWidget';
import RecordSnapshotHeader from '@/components/shared/RecordSnapshotHeader';
import CollapsibleFieldSection from '@/components/shared/CollapsibleFieldSection';
import { InlineText } from '@/components/shared/inline/InlineText';
import { InlineSelect } from '@/components/shared/inline/InlineSelect';
import { CLIENT_STAGES } from '@/components/shared/constants';
import InteractionTimeline from '@/components/shared/InteractionTimeline';
import { useClientDeliveryStatus } from '@/hooks/useClientDeliveryStatus';
import ClientDeliveryStrip from '@/components/clients/ClientDeliveryStrip';
import ReferredByBadge from '@/components/shared/ReferredByBadge';
import { setMayaRecordContext, clearMayaRecordContext } from '@/lib/mayaOrbStore';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const TAB_MIGRATION = {
  proposals: 'commercial',
  invoices: 'commercial',
  interactions: 'activity',
  tasks: 'delivery',
  schedule: 'delivery',
  contacts: 'setup',
  portal: 'setup',
  followup: 'setup',
};

export default function ClientDetailView({ client: initialClient, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requested = urlParams.get('tab');
    if (!requested) return 'overview';
    return TAB_MIGRATION[requested] || requested;
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', title: '', notes: '' });
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

  useEffect(() => {
    if (client?.id && client?.name) {
      setMayaRecordContext({ recordType: 'client', recordId: client.id, recordName: client.name });
    }
    return () => clearMayaRecordContext();
  }, [client?.id, client?.name]);

  const deliverySnapshots = useClientDeliveryStatus(client ? [client] : []);
  const deliverySnapshot = client ? deliverySnapshots[client.id] : null;

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

  const { data: gmailData, isLoading: gmailLoading } = useQuery({
    queryKey: ['gmailHistory', client.email],
    queryFn: async () => {
      const res = await base44.functions.invoke('syncGmailEmails', { clientEmail: client.email });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  const gmailEmailCount = typeof gmailData === 'number' ? gmailData : (gmailData?.emails?.length || 0);

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list('-created_date')
  });

  const clientInvoices = allInvoices.filter(inv => 
    client.invoice_ids?.includes(inv.id) || 
    inv.client_email?.toLowerCase() === client.email?.toLowerCase()
  );

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
      {/* Snapshot Header */}
      <RecordSnapshotHeader record={client} entityType="Client" stages={CLIENT_STAGES} onUpdate={onUpdate} />

      {/* Referral partner badge */}
      {client.referral_partner_name && (
        <ReferredByBadge partnerId={client.referral_partner_id} partnerName={client.referral_partner_name} />
      )}

      {/* Action Bar */}
      <div className="flex justify-end pr-8">
        <Link to={createPageUrl('EditProposal') + `?clientId=${client.id}`}>
          <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132] whitespace-nowrap">
            <FileText className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">New Proposal</span><span className="sm:hidden">Proposal</span>
          </Button>
        </Link>
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
          <TabsTrigger value="activity" className="flex-shrink-0">Activity ({interactions.length + gmailEmailCount})</TabsTrigger>
          <TabsTrigger value="delivery" className="flex-shrink-0">Delivery</TabsTrigger>
          <TabsTrigger value="commercial" className="flex-shrink-0">Commercial ({proposals.length} · {clientInvoices.length})</TabsTrigger>
          <TabsTrigger value="setup" className="flex-shrink-0">Setup</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-1 mt-4">
          {deliverySnapshot && (
            <div className="rounded-xl border border-slate-300 bg-gradient-to-r from-slate-50 to-blue-50 p-4 mb-2 shadow-sm">
              <h4 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-600" />
                Delivery Snapshot
              </h4>
              <ClientDeliveryStrip snapshot={deliverySnapshot} client={client} />
            </div>
          )}
          <CollapsibleFieldSection title="Contact" icon={User} defaultOpen>
            <div className="sm:col-span-2">
              <InlineText label="Email" value={client.email} onSave={v => onUpdate({ email: v })} />
            </div>
            <div className="sm:col-span-2">
              <InlineText label="Secondary Email" value={client.email2} onSave={v => onUpdate({ email2: v })} placeholder="Add secondary email" />
            </div>
            <InlineText label="Phone" value={client.phone} onSave={v => onUpdate({ phone: v })} />
            <InlineText label="Title" value={client.title} onSave={v => onUpdate({ title: v })} />
            <div className="sm:col-span-2">
              <InlineText label="LinkedIn URL" value={client.linkedin_url} onSave={v => onUpdate({ linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
            </div>
            {client.linkedin_url && (
              <div className="sm:col-span-2">
                <a href={client.linkedin_url.startsWith('http') ? client.linkedin_url : `https://${client.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#0a66c2] hover:underline">
                  <Linkedin className="w-4 h-4" />Open LinkedIn Profile
                </a>
              </div>
            )}
          </CollapsibleFieldSection>

          <CollapsibleFieldSection title="Company Details" icon={Building} defaultOpen>
            <InlineText label="Industry" value={client.industry} onSave={v => onUpdate({ industry: v })} />
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Company Size</span>
              <InlineSelect label="Company Size" value={client.company_size} onSave={v => onUpdate({ company_size: v })} options={['1-50','51-200','201-500','501-1000','1001-5000','5000+']} />
            </div>
            <div className="sm:col-span-2">
              <InlineText label="Website" value={client.company_website} onSave={v => onUpdate({ company_website: v })} />
            </div>
            <div className="sm:col-span-2">
              <InlineText label="Address" value={client.company_address} onSave={v => onUpdate({ company_address: v })} />
            </div>
          </CollapsibleFieldSection>

          <CollapsibleFieldSection title="Wellness & Financials" icon={DollarSign}>
            <InlineText label="Wellness Budget ($)" value={client.wellness_budget} onSave={v => onUpdate({ wellness_budget: v ? Number(v) : null })} />
            <InlineText label="Fund Size / Employee ($)" value={client.wellness_fund_size} onSave={v => onUpdate({ wellness_fund_size: v ? Number(v) : null })} />
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Plan Year Start</span>
              <input type="date" value={client.plan_year_start || ''} onChange={e => onUpdate({ plan_year_start: e.target.value })} className="w-full bg-transparent text-sm text-gray-700 border-0 p-0 focus:outline-none cursor-pointer" />
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Renewal Date</span>
              <input type="date" value={client.renewal_date || ''} onChange={e => onUpdate({ renewal_date: e.target.value })} className="w-full bg-transparent text-sm text-gray-700 border-0 p-0 focus:outline-none cursor-pointer" />
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Tier</span>
              <InlineSelect label="Tier" value={client.tier} onSave={v => onUpdate({ tier: v })} options={['Tier 1', 'Tier 2', 'Tier 3']} />
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Renewal Cohort</span>
              <InlineSelect label="Renewal Cohort" value={client.renewal_cohort} onSave={v => onUpdate({ renewal_cohort: v })} options={['Jan 1', 'July 1', 'Off-Cycle']} />
            </div>
          </CollapsibleFieldSection>

          <CollapsibleFieldSection title="Relationships" icon={Users}>
            <div className="sm:col-span-2">
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-1">Broker(s)</span>
              <BrokersEditor
                brokers={client.brokers?.length > 0
                  ? client.brokers
                  : (client.broker_name ? [{ name: client.broker_name, email: client.broker_email || '', company: '', phone: '', notes: '' }] : [])
                }
                onChange={(brokers) => onUpdate({ brokers })}
              />
            </div>
            <InlineText label="Consultant Name" value={client.wellness_consultant_name} onSave={v => onUpdate({ wellness_consultant_name: v })} />
            <InlineText label="Consultant Email" value={client.wellness_consultant_email} onSave={v => onUpdate({ wellness_consultant_email: v })} />
            <div className="sm:col-span-2">
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Referral Partner</span>
              <Select value={client.referral_partner_id || 'none'} onValueChange={v => {
                const partner = referralPartners.find(p => p.id === v);
                onUpdate({ referral_partner_id: v === 'none' ? '' : v, referral_partner_name: partner?.name || '' });
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
          </CollapsibleFieldSection>

          <CollapsibleFieldSection title="Notes" icon={StickyNote}>
            <div className="sm:col-span-2">
              <InlineText value={client.notes} onSave={v => onUpdate({ notes: v })} multiline placeholder="Add notes..." />
            </div>
          </CollapsibleFieldSection>

          <MayaInsightsWidget recordType="client" recordId={client.id} owner={client.owner} />

          {/* Purchased Services Section */}
          <div className="rounded-lg border p-4 bg-emerald-50 border-emerald-200">
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
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <InteractionTimeline client_id={client.id} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['client', client.id] })} />
        </TabsContent>

        {/* Delivery Tab — Schedule + Tasks */}
        <TabsContent value="delivery" className="mt-4 space-y-4">
          <ClientScheduleTab client={client} />
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

        {/* Commercial Tab — Proposals + Invoices */}
        <TabsContent value="commercial" className="mt-4 space-y-6">
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

          {/* Invoices */}
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-700 mb-4">Invoices ({clientInvoices.length})</h4>
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
          </div>
        </TabsContent>

        {/* Setup Tab — Contacts + Portal Docs + Follow-Up */}
        <TabsContent value="setup" className="mt-4 space-y-2">
          <CollapsibleFieldSection title="Contacts" icon={Users} defaultOpen>
           <div className="flex justify-between items-center mb-4">
             <h4 className="font-semibold text-gray-700">All Contacts</h4>
             <Button size="sm" variant="outline" onClick={() => { setEditingContact(null); setShowAddContact(true); }}>
               <Plus className="w-4 h-4 mr-1" /> Add Contact
             </Button>
           </div>

           <div className="space-y-3">
             {/* Primary Contact */}
             <PrimaryContactEditor client={client} onUpdate={onUpdate} />


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

               const handleMakePrimary = () => {
                 // New primary fields from this contact
                 const newPrimary = {
                   name: contact.name || '',
                   email: contact.email || '',
                   title: contact.title || '',
                   phone: contact.phone || '',
                 };
                 // Old primary becomes a related contact
                 const oldPrimaryAsContact = {
                   name: client.name || '',
                   email: client.email || '',
                   title: client.title || '',
                   phone: client.phone || '',
                   notes: '',
                 };
                 // Remove this contact from related_contacts, add old primary
                 const updatedContacts = [
                   ...( client.related_contacts || []).filter((_, i) => i !== index),
                   oldPrimaryAsContact,
                 ];
                 onUpdate({ ...newPrimary, related_contacts: updatedContacts });
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
                   <div className="flex gap-1 items-start flex-col sm:flex-row">
                     {contact.name && contact.email && (
                       <Button size="sm" variant="outline" className="text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleMakePrimary}>
                         Make Primary
                       </Button>
                     )}
                     <Button size="icon" variant="ghost" onClick={() => openEditContact(contact, index)}><Pencil className="w-4 h-4" /></Button>
                     <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDeleteContact(index)}><Trash2 className="w-4 h-4" /></Button>
                   </div>
                 </div>
               </div>
               );
             })}
          </div>
          </CollapsibleFieldSection>

          <CollapsibleFieldSection title="Portal Documents" icon={FileText}>
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
          </CollapsibleFieldSection>

          <CollapsibleFieldSection title="Follow-Up Settings" icon={Clock}>
            <FollowUpSettings client={client} onUpdate={onUpdate} />
          </CollapsibleFieldSection>
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


    </div>
  );
}