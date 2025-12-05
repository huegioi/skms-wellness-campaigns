import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, User, Building, Mail, Phone, FileText, Pencil, Trash2, Search, Filter, 
  DollarSign, Users, Calendar, Globe, MapPin, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ClientDetailView from '@/components/clients/ClientDetailView';
import DuplicateChecker from '@/components/clients/DuplicateChecker';

// Client Form Fields Component - defined outside to prevent re-renders
function ClientFormFields({ formData, setFormData, clients, isEdit, editingClient, onSelectDuplicate }) {
  return (
    <>
      <DuplicateChecker 
        clients={clients} 
        email={formData.email} 
        company={formData.company}
        currentClientId={isEdit ? editingClient?.id : null}
        onSelectDuplicate={onSelectDuplicate}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <Input placeholder="Job Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
        <Input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
      </div>
      <Input placeholder="Company" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} />
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="Industry" value={formData.industry} onChange={(e) => setFormData({...formData, industry: e.target.value})} />
        <Select value={formData.company_size || "none"} onValueChange={(v) => setFormData({...formData, company_size: v === "none" ? "" : v})}>
          <SelectTrigger><SelectValue placeholder="Company Size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select size...</SelectItem>
            <SelectItem value="1-50">1-50 employees</SelectItem>
            <SelectItem value="51-200">51-200 employees</SelectItem>
            <SelectItem value="201-500">201-500 employees</SelectItem>
            <SelectItem value="501-1000">501-1000 employees</SelectItem>
            <SelectItem value="1001-5000">1001-5000 employees</SelectItem>
            <SelectItem value="5000+">5000+ employees</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input placeholder="Company Website" value={formData.company_website} onChange={(e) => setFormData({...formData, company_website: e.target.value})} />
      <Input placeholder="Company Address" value={formData.company_address} onChange={(e) => setFormData({...formData, company_address: e.target.value})} />
      <Input type="number" placeholder="Wellness Budget ($)" value={formData.wellness_budget} onChange={(e) => setFormData({...formData, wellness_budget: e.target.value ? Number(e.target.value) : ''})} />
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium text-gray-600 mb-2">Broker Information</p>
        <div className="grid grid-cols-2 gap-4">
          <Input placeholder="Broker Name" value={formData.broker_name} onChange={(e) => setFormData({...formData, broker_name: e.target.value})} />
          <Input type="email" placeholder="Broker Email" value={formData.broker_email} onChange={(e) => setFormData({...formData, broker_email: e.target.value})} />
        </div>
      </div>
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium text-gray-600 mb-2">Wellness Consultant Information</p>
        <div className="grid grid-cols-2 gap-4">
          <Input placeholder="Consultant Name" value={formData.wellness_consultant_name} onChange={(e) => setFormData({...formData, wellness_consultant_name: e.target.value})} />
          <Input type="email" placeholder="Consultant Email" value={formData.wellness_consultant_email} onChange={(e) => setFormData({...formData, wellness_consultant_email: e.target.value})} />
        </div>
      </div>
      <Textarea placeholder="Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
    </>
  );
}

export default function Clients() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', email: '', company: '', phone: '', title: '', industry: '', 
    company_size: '', company_address: '', company_website: '', wellness_budget: '', 
    broker_name: '', broker_email: '', wellness_consultant_name: '', wellness_consultant_email: '', notes: '' 
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [filterBudget, setFilterBudget] = useState('all');
  
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date')
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsAddDialogOpen(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditingClient(null);
      if (viewingClient) {
        // Refresh viewing client data
        const updated = clients.find(c => c.id === viewingClient.id);
        if (updated) setViewingClient({ ...viewingClient, ...updated });
      }
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setViewingClient(null);
    }
  });

  const resetForm = () => setFormData({ 
    name: '', email: '', company: '', phone: '', title: '', industry: '', 
    company_size: '', company_address: '', company_website: '', wellness_budget: '', 
    broker_name: '', broker_email: '', wellness_consultant_name: '', wellness_consultant_email: '', notes: '' 
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (submitData.wellness_budget === '') delete submitData.wellness_budget;
    
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const openEditDialog = (client) => {
    setFormData({ 
      name: client.name, 
      email: client.email, 
      company: client.company || '', 
      phone: client.phone || '', 
      title: client.title || '',
      industry: client.industry || '',
      company_size: client.company_size || '',
      company_address: client.company_address || '',
      company_website: client.company_website || '',
      wellness_budget: client.wellness_budget || '',
      broker_name: client.broker_name || '',
      broker_email: client.broker_email || '',
      wellness_consultant_name: client.wellness_consultant_name || '',
      wellness_consultant_email: client.wellness_consultant_email || '',
      notes: client.notes || '' 
    });
    setEditingClient(client);
  };

  const handleClientUpdate = (updates) => {
    if (viewingClient) {
      updateMutation.mutate({ id: viewingClient.id, data: updates });
      setViewingClient({ ...viewingClient, ...updates });
    }
  };

  const getClientProposals = (clientId) => proposals.filter(p => p.client_id === clientId);
  const uniqueIndustries = [...new Set(clients.filter(c => c.industry).map(c => c.industry))];

  const filteredClients = clients.filter(client => {
    const matchesSearch = !searchQuery || 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.company || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesIndustry = filterIndustry === 'all' || client.industry === filterIndustry;
    const matchesSize = filterSize === 'all' || client.company_size === filterSize;
    
    let matchesBudget = true;
    if (filterBudget !== 'all') {
      const budget = client.wellness_budget || 0;
      if (filterBudget === 'under10k') matchesBudget = budget < 10000;
      else if (filterBudget === '10k-50k') matchesBudget = budget >= 10000 && budget < 50000;
      else if (filterBudget === '50k-100k') matchesBudget = budget >= 50000 && budget < 100000;
      else if (filterBudget === 'over100k') matchesBudget = budget >= 100000;
    }
    
    return matchesSearch && matchesIndustry && matchesSize && matchesBudget;
  });

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-purple-100 text-purple-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700'
  };

  if (clientsLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  const handleSelectDuplicate = (client) => {
    setIsAddDialogOpen(false);
    setEditingClient(null);
    setViewingClient(client);
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Clients</h1>
            <p className="text-gray-600">Manage your clients, contacts, and interactions</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#264d44] hover:bg-[#1a3830]" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                <ClientFormFields 
                  formData={formData} 
                  setFormData={setFormData} 
                  clients={clients}
                  isEdit={false}
                  editingClient={null}
                  onSelectDuplicate={handleSelectDuplicate}
                />
                <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">Add Client</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 shadow-lg mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search by name, email, or company..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              
              <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {uniqueIndustries.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSize} onValueChange={setFilterSize}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Company Size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="1-50">1-50</SelectItem>
                  <SelectItem value="51-200">51-200</SelectItem>
                  <SelectItem value="201-500">201-500</SelectItem>
                  <SelectItem value="501-1000">501-1000</SelectItem>
                  <SelectItem value="1001-5000">1001-5000</SelectItem>
                  <SelectItem value="5000+">5000+</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterBudget} onValueChange={setFilterBudget}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Budget" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Budgets</SelectItem>
                  <SelectItem value="under10k">Under $10k</SelectItem>
                  <SelectItem value="10k-50k">$10k - $50k</SelectItem>
                  <SelectItem value="50k-100k">$50k - $100k</SelectItem>
                  <SelectItem value="over100k">Over $100k</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(searchQuery || filterIndustry !== 'all' || filterSize !== 'all' || filterBudget !== 'all') && (
            <div className="mt-3 text-sm text-gray-500">
              Showing {filteredClients.length} of {clients.length} clients
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <ClientFormFields 
                formData={formData} 
                setFormData={setFormData} 
                clients={clients}
                isEdit={true}
                editingClient={editingClient}
                onSelectDuplicate={handleSelectDuplicate}
              />
              <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">Save Changes</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Client Detail View Dialog */}
        <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {viewingClient && (
              <ClientDetailView 
                client={viewingClient} 
                onClose={() => setViewingClient(null)}
                onUpdate={handleClientUpdate}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Client List */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No clients yet</h3>
            <p className="text-gray-500 mb-4">Add your first client to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClients.map(client => {
              const clientProposals = getClientProposals(client.id);
              const acceptedProposals = clientProposals.filter(p => p.status === 'accepted');
              const totalValue = acceptedProposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);
              const contactCount = (client.related_contacts?.length || 0) + 1;
              
              return (
                <div key={client.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 cursor-pointer" onClick={() => setViewingClient(client)}>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>{client.name}</h3>
                          {client.title && <span className="text-gray-500">• {client.title}</span>}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          {client.company && (
                            <span className="flex items-center gap-1"><Building className="w-4 h-4" /> {client.company}</span>
                          )}
                          <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {client.email}</span>
                          {client.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {client.phone}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {client.industry && <Badge variant="outline">{client.industry}</Badge>}
                          {client.company_size && (
                            <span className="flex items-center gap-1 text-sm text-gray-500"><Users className="w-4 h-4" /> {client.company_size}</span>
                          )}
                          {client.wellness_budget > 0 && (
                            <span className="flex items-center gap-1 text-sm text-green-600"><DollarSign className="w-4 h-4" /> ${client.wellness_budget.toLocaleString()} budget</span>
                          )}
                          {contactCount > 1 && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200">{contactCount} contacts</Badge>
                          )}
                          {clientProposals.length > 0 && (
                            <Badge variant="outline">{clientProposals.length} proposal{clientProposals.length !== 1 ? 's' : ''}</Badge>
                          )}
                          {totalValue > 0 && (
                            <Badge className="bg-green-100 text-green-700">${totalValue.toLocaleString()} won</Badge>
                          )}
                          {client.last_contacted && (
                            <span className="flex items-center gap-1 text-sm text-gray-500"><Calendar className="w-4 h-4" /> {new Date(client.last_contacted).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setViewingClient(client)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                        <Link to={createPageUrl('CurriculumDesigner') + `?clientId=${client.id}`}>
                          <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132]">
                            <FileText className="w-4 h-4 mr-1" /> Proposal
                          </Button>
                        </Link>
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(client)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(client.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}