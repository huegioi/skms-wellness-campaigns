import React, { useState } from 'react';
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
  ChevronRight, Clock, CheckCircle, XCircle, Eye, Send, Package, Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { productCatalog } from '@/components/curriculum/catalogData';

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

export default function ClientDetailView({ client, onClose, onUpdate }) {
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

  const queryClient = useQueryClient();

  const { data: allServices = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals', client.id],
    queryFn: async () => {
      const all = await base44.entities.Proposal.list('-created_date');
      return all.filter(p => p.client_id === client.id);
    }
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions', client.id],
    queryFn: () => base44.entities.ClientInteraction.filter({ client_id: client.id }, '-date')
  });

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

  // Extract services from accepted proposals
  const getServicesFromProposals = () => {
    const serviceIds = new Set();
    proposals.filter(p => p.status === 'accepted').forEach(proposal => {
      const sel = proposal.selections || {};
      (sel.workshops || []).forEach(id => serviceIds.add(id));
      (sel.challengePrograms || []).forEach(id => serviceIds.add(id));
      (sel.leadership || []).forEach(id => serviceIds.add(id));
      (sel.movementClasses || []).forEach(id => serviceIds.add(id));
    });
    
    // Add any manually added services from client record
    (client.purchased_services || []).forEach(id => serviceIds.add(id));
    
    return Array.from(serviceIds);
  };

  const clientServiceIds = getServicesFromProposals();

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Proposals</p>
          <p className="text-2xl font-bold" style={{ color: '#013f7c' }}>{proposals.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-green-600">${totalProposalValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Won Value</p>
          <p className="text-2xl font-bold" style={{ color: '#770142' }}>${acceptedValue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Interactions</p>
          <p className="text-2xl font-bold text-blue-600">{interactions.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({(client.related_contacts?.length || 0) + 1})</TabsTrigger>
          <TabsTrigger value="proposals">Proposals ({proposals.length})</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="interactions">Activity ({interactions.length})</TabsTrigger>
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

          {client.purchased_services?.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-700 mb-2">Previously Purchased Services</h4>
              <div className="flex flex-wrap gap-2">
                {client.purchased_services.map((s, i) => (
                  <Badge key={i} className="bg-green-100 text-green-700">{getServiceName(s)}</Badge>
                ))}
              </div>
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
          <div className="space-y-3">
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
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-700">Active Services</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddService(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Service
            </Button>
          </div>

          <div className="space-y-3">
            {clientServiceIds.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No services yet</p>
            ) : (
              clientServiceIds.map(serviceId => {
                const service = allServices.find(s => s.id === serviceId);
                if (!service) return null;

                return (
                  <div key={serviceId} className="bg-white border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#264d44] flex items-center justify-center">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">{service.name}</p>
                          <p className="text-sm text-gray-600">{service.short_description || service.description?.slice(0, 100)}</p>
                          <div className="flex gap-3 mt-2 text-xs text-gray-500">
                            <span>${service.price?.toLocaleString()}</span>
                            {service.duration && <span>{service.duration}</span>}
                          </div>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeService(serviceId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
      </Tabs>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                  items.push({ category: 'Workshops', services: sel.workshops });
                }
                if (sel.challengePrograms?.length > 0) {
                  items.push({ category: '14-Day Challenges', services: sel.challengePrograms });
                }
                if (sel.leadership?.length > 0) {
                  items.push({ category: 'Leadership', services: sel.leadership });
                }
                if (sel.movementClasses?.length > 0) {
                  items.push({ category: 'Classes', services: sel.movementClasses });
                }

                return items.map(({ category, services }, idx) => (
                  <div key={idx} className="bg-white border rounded-lg p-4">
                    <h4 className="font-semibold mb-2" style={{ color: '#264d44' }}>{category}</h4>
                    <ul className="space-y-1">
                      {services.map(serviceId => {
                        const service = allServices.find(s => s.id === serviceId);
                        return (
                          <li key={serviceId} className="text-sm text-gray-600">
                            • {service?.name || getServiceName(serviceId)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Select value={serviceToAdd} onValueChange={setServiceToAdd}>
              <SelectTrigger><SelectValue placeholder="Select a service..." /></SelectTrigger>
              <SelectContent>
                {allServices.filter(s => s.is_active !== false && !clientServiceIds.includes(s.id)).map(service => (
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

      {/* Add Interaction Dialog */}
      <Dialog open={showAddInteraction} onOpenChange={setShowAddInteraction}>
        <DialogContent>
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