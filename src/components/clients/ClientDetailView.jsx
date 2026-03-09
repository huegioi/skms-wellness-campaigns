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
  Upload, ExternalLink, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TaskList from '@/components/tasks/TaskList';
import GmailHistory from '@/components/clients/GmailHistory';
import { productCatalog } from '@/components/curriculum/catalogData';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  // Extract services from accepted proposals - match by name
  const getClientServices = () => {
    const serviceNames = new Set();
    
    proposals.filter(p => p.status === 'accepted').forEach(proposal => {
      const sel = proposal.selections || {};
      
      (sel.workshops || []).forEach(key => {
        if (productCatalog.workshops[key]) {
          serviceNames.add(productCatalog.workshops[key].name);
        }
      });
      (sel.challengePrograms || []).forEach(key => {
        if (productCatalog.challenges[key]) {
          serviceNames.add(productCatalog.challenges[key].name);
        }
      });
      (sel.leadership || []).forEach(key => {
        if (productCatalog.leadership[key]) {
          serviceNames.add(productCatalog.leadership[key].name);
        }
      });
      (sel.movementClasses || []).forEach(key => {
        if (productCatalog.movementClasses[key]) {
          serviceNames.add(productCatalog.movementClasses[key].name);
        }
      });
    });
    
    const matchedServices = allServices.filter(service => serviceNames.has(service.name));
    const manualServices = allServices.filter(service => (client.purchased_services || []).includes(service.id));
    
    const allClientServices = [...matchedServices, ...manualServices];
    return Array.from(new Map(allClientServices.map(s => [s.id, s])).values());
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#264d44' }}>{client.name}</h2>
          {client.title && <p className="text-gray-600">{client.title}</p>}
          {client.company && (
            <p className="text-lg text-gray-700 flex items-center gap-2 mt-1">
              <Building className="w-4 h-4" /> {client.company}
            </p>
          )}
        </div>
        <Link to={createPageUrl('CurriculumDesigner') + `?clientId=${client.id}`}>
          <Button className="bg-[#770142] hover:bg-[#5a0132]">
            <FileText className="w-4 h-4 mr-2" /> New Proposal
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
          <p className="text-xl sm:text-2xl font-bold" style={{ color: '#770142' }}>${acceptedValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Interactions</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{interactions.length}</p>
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
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
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
              {client.wellness_budget && <p className="flex items-center gap-2 text-sm text-green-600"><DollarSign className="w-4 h-4" /> ${client.wellness_budget.toLocaleString()} budget</p>}
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
          
          {/* Broker & Consultant Info */}
          {(client.broker_name || client.broker_email || client.wellness_consultant_name || client.wellness_consultant_email) && (
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {(client.broker_name || client.broker_email) && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">Broker</h4>
                {client.broker_name && <p className="text-sm font-medium">{client.broker_name}</p>}
                {client.broker_email && <p className="flex items-center gap-2 text-sm text-blue-600"><Mail className="w-4 h-4" /> {client.broker_email}</p>}
              </div>
            )}
            {(client.wellness_consultant_name || client.wellness_consultant_email) && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">Wellness Consultant</h4>
                {client.wellness_consultant_name && <p className="text-sm font-medium">{client.wellness_consultant_name}</p>}
                {client.wellness_consultant_email && <p className="flex items-center gap-2 text-sm text-purple-600"><Mail className="w-4 h-4" /> {client.wellness_consultant_email}</p>}
              </div>
            )}
          </div>
          )}
          
          {client.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-700 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {clientServices.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-700">Services</h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddService(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {clientServices.map(service => (
                  <Badge key={service.id} className="bg-green-100 text-green-700 flex items-center gap-1">
                    {service.name}
                    <button onClick={() => removeService(service.id)} className="ml-1 hover:text-red-600">×</button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {clientServices.length === 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-700">Services</h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddService(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Add Service
                </Button>
              </div>
              <p className="text-sm text-gray-400 mt-1">No services yet</p>
            </div>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-700">All Contacts</h4>
            <Button size="sm" variant="outline" onClick={() => { setContactForm({ name: '', email: '', phone: '', title: '', notes: '' }); setEditingContact(null); setShowAddContact(true); }}>
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

            {/* Related Contacts */}
            {(client.related_contacts || []).map((contact, index) => (
              <div key={index} className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{contact.name}</p>
                    {contact.title && <p className="text-sm text-gray-600">{contact.title}</p>}
                    {contact.email && <p className="text-sm text-gray-500">{contact.email}</p>}
                    {contact.phone && <p className="text-sm text-gray-500">{contact.phone}</p>}
                    {contact.notes && <p className="text-sm text-gray-400 mt-1">{contact.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditContact(contact, index)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDeleteContact(index)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
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
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingContact !== null ? 'Edit Contact' : 'Add Related Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Name *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
            <Input placeholder="Title" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} />
            <Input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
            <Textarea placeholder="Notes" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
            <Button onClick={handleAddContact} disabled={!contactForm.name} className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              {editingContact !== null ? 'Save Changes' : 'Add Contact'}
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