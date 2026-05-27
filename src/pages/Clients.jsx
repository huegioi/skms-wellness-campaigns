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
  Plus, User, Building, Mail, Phone, FileText, Trash2, Search, Filter, 
  DollarSign, Users, Calendar, Eye, AlertTriangle, XCircle, FolderOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ClientDetailView from '@/components/clients/ClientDetailView';
import DuplicateChecker from '@/components/clients/DuplicateChecker';
import { createDefaultTasksForClient } from '@/components/tasks/taskTemplates';
import ClientsSubNav from '@/components/clients/ClientsSubNav.jsx';
import BrokersEditor from '@/components/clients/BrokersEditor';
import ClientPipelineView from '@/components/clients/ClientPipelineView';
import { LayoutList, Columns } from 'lucide-react';

// Client Form Fields Component - defined outside to prevent re-renders
function ClientFormFields({ formData, setFormData, clients, isEdit, editingClient, onSelectDuplicate, referralPartners = [] }) {
  return (
    <>
      <DuplicateChecker 
        clients={clients} 
        email={formData.email} 
        company={formData.company}
        currentClientId={isEdit ? editingClient?.id : null}
        onSelectDuplicate={onSelectDuplicate}
      />
      <Input placeholder="Company Name *" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input placeholder="Contact Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <Input placeholder="Job Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input type="email" placeholder="Contact Email *" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
        <Input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Plan Year Start Date</label>
          <Input type="date" value={formData.plan_year_start} onChange={(e) => setFormData({...formData, plan_year_start: e.target.value})} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Wellness Fund Size (per employee $)</label>
          <Input type="number" placeholder="e.g. 500" value={formData.wellness_fund_size} onChange={(e) => setFormData({...formData, wellness_fund_size: e.target.value ? Number(e.target.value) : ''})} />
        </div>
      </div>
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium text-gray-600 mb-2">Broker(s)</p>
        <BrokersEditor
          brokers={formData.brokers || []}
          onChange={(brokers) => setFormData({ ...formData, brokers })}
        />
      </div>
      <div className="border-t pt-4 mt-2">
        <p className="text-sm font-medium text-gray-600 mb-2">Wellness Consultant Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input placeholder="Consultant Name" value={formData.wellness_consultant_name} onChange={(e) => setFormData({...formData, wellness_consultant_name: e.target.value})} />
          <Input type="email" placeholder="Consultant Email" value={formData.wellness_consultant_email} onChange={(e) => setFormData({...formData, wellness_consultant_email: e.target.value})} />
        </div>
      </div>
      {/* Referral Partner */}
      {referralPartners.length > 0 && (
        <div className="border-t pt-4 mt-2">
          <p className="text-sm font-medium text-gray-600 mb-2">Referral Source</p>
          <Select value={formData.referral_partner_id || 'none'} onValueChange={(v) => {
            const partner = referralPartners.find(p => p.id === v);
            setFormData({ ...formData, referral_partner_id: v === 'none' ? '' : v, referral_partner_name: partner?.name || '' });
          }}>
            <SelectTrigger><SelectValue placeholder="Referred by a partner?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No referral partner</SelectItem>
              {referralPartners.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Textarea placeholder="Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
    </>
  );
}

export default function Clients() {
  const urlParams = new URLSearchParams(window.location.search);
  const clientIdFromUrl = urlParams.get('clientId');
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const urlClientDismissed = React.useRef(false);
  const [viewingClient, setViewingClient] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', email: '', company: '', phone: '', title: '', industry: '', 
    company_size: '', company_address: '', company_website: '', wellness_budget: '', 
    plan_year_start: '', wellness_fund_size: '',
    brokers: [],
    wellness_consultant_name: '', wellness_consultant_email: '',
    referral_partner_id: '', referral_partner_name: '', notes: '' 
  });
  
  const [viewMode, setViewMode] = useState('list');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [filterBudget, setFilterBudget] = useState('all');
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [mergingClients, setMergingClients] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date')
  });

  const { data: referralPartners = [] } = useQuery({
    queryKey: ['referralPartners'],
    queryFn: () => base44.entities.ReferralPartner.filter({ is_active: true }, 'name')
  });

  // Auto-open client detail if URL param is present (only once)
  React.useEffect(() => {
    if (clientIdFromUrl && clients.length > 0 && !urlClientDismissed.current) {
      const client = clients.find(c => c.id === clientIdFromUrl);
      if (client) {
        setViewingClient(client);
      }
    }
  }, [clientIdFromUrl, clients]);

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: async (newClient) => {
      // Auto-create tasks for new client
      await createDefaultTasksForClient(base44, newClient.id, newClient.name);

      // If a referral partner was assigned, create a Referral record
      if (newClient.referral_partner_id) {
        await base44.entities.Referral.create({
          referral_partner_id: newClient.referral_partner_id,
          referral_partner_name: newClient.referral_partner_name || '',
          referred_client_id: newClient.id,
          contact_name: newClient.name,
          contact_email: newClient.email,
          company_name: newClient.company || '',
          referral_date: new Date().toISOString(),
          status: 'converted_to_client',
        });
        queryClient.invalidateQueries({ queryKey: ['referrals'] });
      }
      
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
      setIsAddDialogOpen(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
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
    plan_year_start: '', wellness_fund_size: '',
    brokers: [],
    wellness_consultant_name: '', wellness_consultant_email: '',
    referral_partner_id: '', referral_partner_name: '', notes: '' 
  });

  const checkForDuplicates = () => {
    const duplicates = [];
    
    if (formData.email) {
      const emailLower = formData.email.toLowerCase().trim();
      clients.forEach(client => {
        if (client.email?.toLowerCase().trim() === emailLower) {
          duplicates.push({ client, matchType: 'email' });
        }
      });
    }
    
    if (formData.company) {
      const companyLower = formData.company.toLowerCase().trim();
      clients.forEach(client => {
        if (client.company?.toLowerCase().trim() === companyLower) {
          if (!duplicates.find(d => d.client.id === client.id)) {
            duplicates.push({ client, matchType: 'company' });
          }
        }
      });
    }
    
    return duplicates;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check for duplicates when creating new client
    {
      const duplicates = checkForDuplicates();
      if (duplicates.length > 0) {
        const confirmed = window.confirm(
          `Warning: A similar client already exists:\n\n${duplicates.map(d => `${d.client.name} (${d.client.email})`).join('\n')}\n\nAre you sure you want to create a new client?`
        );
        if (!confirmed) {
          return;
        }
      }
    }
    
    const submitData = { ...formData };
    if (submitData.wellness_budget === '') delete submitData.wellness_budget;
    if (submitData.wellness_fund_size === '') delete submitData.wellness_fund_size;
    if (submitData.plan_year_start === '') delete submitData.plan_year_start;
    
    createMutation.mutate(submitData);
  };

  const handleClientUpdate = (updates) => {
    if (viewingClient) {
      updateMutation.mutate({ id: viewingClient.id, data: updates });
      setViewingClient({ ...viewingClient, ...updates });
    }
  };

  const getClientProposals = (clientId) => proposals.filter(p => p.client_id === clientId);
  const uniqueIndustries = [...new Set(clients.filter(c => c.industry).map(c => c.industry))];

  // Detect duplicate clients
  const detectDuplicates = () => {
    const duplicateGroups = [];
    const processed = new Set();

    clients.forEach(client => {
      if (processed.has(client.id)) return;

      const matches = clients.filter(c => {
        if (c.id === client.id || processed.has(c.id)) return false;
        
        const emailMatch = c.email && client.email && 
          c.email.toLowerCase().trim() === client.email.toLowerCase().trim();
        
        const companyMatch = c.company && client.company && 
          c.company.toLowerCase().trim() === client.company.toLowerCase().trim();
        
        return emailMatch || companyMatch;
      });

      if (matches.length > 0) {
        const group = [client, ...matches];
        group.forEach(c => processed.add(c.id));
        duplicateGroups.push(group);
      }
    });

    return duplicateGroups;
  };

  const duplicateGroups = detectDuplicates();

  const mergeClients = async (primaryClient, duplicateClient) => {
    try {
      // Update all proposals from duplicate to point to primary
      const duplicateProposals = proposals.filter(p => p.client_id === duplicateClient.id);
      for (const proposal of duplicateProposals) {
        await base44.entities.Proposal.update(proposal.id, {
          client_id: primaryClient.id,
          client_name: primaryClient.name,
          client_email: primaryClient.email
        });
      }

      // Merge related contacts
      const mergedContacts = [
        ...(primaryClient.related_contacts || []),
        ...(duplicateClient.related_contacts || [])
      ];

      // Update primary client with merged data
      await base44.entities.Client.update(primaryClient.id, {
        related_contacts: mergedContacts,
        notes: [primaryClient.notes, duplicateClient.notes].filter(Boolean).join('\n\n---\n\n'),
        last_contacted: duplicateClient.last_contacted || primaryClient.last_contacted
      });

      // Delete duplicate client
      await base44.entities.Client.delete(duplicateClient.id);

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setMergingClients(null);
    } catch (error) {
      console.error('Error merging clients:', error);
      alert('Failed to merge clients. Please try again.');
    }
  };

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
    setViewingClient(client);
  };

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      <ClientsSubNav activePage="Clients" />

      <div className={`mx-auto px-4 md:px-8 py-6 ${viewMode === 'pipeline' ? 'max-w-full' : 'max-w-5xl'}`}>
        {/* Toolbar: view toggle + owner filter + add button */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-[#264d44] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutList className="w-4 h-4" /> List
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'pipeline' ? 'bg-[#264d44] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Columns className="w-4 h-4" /> Pipeline
              </button>
            </div>

            {/* Owner filter (always visible, useful in both views) */}
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                <SelectItem value="William">William</SelectItem>
                <SelectItem value="Heather">Heather</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add Client Button */}
          <div className="flex justify-end">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#264d44] hover:bg-[#1a3830]" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[95vw] sm:w-full">
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
                  referralPartners={referralPartners}
                />
                <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">Add Client</Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Duplicate Alert */}
        {showDuplicates && duplicateGroups.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 shadow-lg mb-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-amber-800">Duplicate Clients Detected</h3>
                </div>
                <p className="text-sm text-amber-700 mb-3">
                  {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} of duplicate clients found. 
                  Click "Merge" to combine them.
                </p>
                <div className="space-y-2">
                  {duplicateGroups.map((group, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 mb-1">
                            {group.map(c => c.company || c.name).join(' & ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {group.map(c => c.name).join(' & ')} • {group[0].email}
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            {group.reduce((sum, c) => sum + getClientProposals(c.id).length, 0)} total proposals
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => setMergingClients(group)}
                        >
                          Merge
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowDuplicates(false)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 shadow-lg mb-6">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search by name, email, or company..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
              
              <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {uniqueIndustries.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSize} onValueChange={setFilterSize}>
                <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Company Size" /></SelectTrigger>
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
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Budget" /></SelectTrigger>
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

        {/* Client Detail View Dialog */}
        <Dialog open={!!viewingClient} onOpenChange={(open) => { if (!open) { urlClientDismissed.current = true; setViewingClient(null); } }}>
          <DialogContent className="max-w-3xl w-[95vw] sm:w-full h-[90vh] flex flex-col p-0 overflow-hidden">
            {viewingClient && (
              <ClientDetailView 
                client={viewingClient} 
                onClose={() => setViewingClient(null)}
                onUpdate={handleClientUpdate}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Merge Clients Dialog */}
        <Dialog open={!!mergingClients} onOpenChange={(open) => !open && setMergingClients(null)}>
          <DialogContent className="max-w-lg w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle>Merge Duplicate Clients</DialogTitle>
            </DialogHeader>
            {mergingClients && (
              <div className="space-y-4 mt-4">
                <p className="text-sm text-gray-600">
                  Select which client to keep as the primary record. All proposals and contacts will be merged into this client.
                </p>
                <div className="space-y-2">
                  {mergingClients.map(client => {
                    const clientProposals = getClientProposals(client.id);
                    return (
                      <div key={client.id} className="border rounded-lg p-4 hover:border-blue-500 cursor-pointer transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{client.company || client.name}</p>
                            <p className="text-sm text-gray-600">{client.name}{client.title ? ` · ${client.title}` : ''}</p>
                            <p className="text-sm text-gray-500">{client.email}</p>
                          </div>
                          <Badge variant="outline">{clientProposals.length} proposals</Badge>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {mergingClients.map(other => {
                            if (other.id === client.id) return null;
                            return (
                              <Button 
                                key={other.id}
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => mergeClients(client, other)}
                              >
                                Keep This, Merge {other.name}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setMergingClients(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Pipeline View */}
        {viewMode === 'pipeline' && (
          <ClientPipelineView
            clients={filteredClients}
            ownerFilter={ownerFilter}
            onClientClick={setViewingClient}
          />
        )}

        {/* Client List */}
        {viewMode === 'list' && (filteredClients.length === 0 ? (
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
                        <div className="flex items-center gap-2 mb-1">
                          <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>
                            {client.company || client.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium">{client.name}</span>
                          {client.title && <span className="text-gray-400">· {client.title}</span>}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
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
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 ml-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setViewingClient(client)}>
                            <Eye className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">View</span>
                          </Button>
                          {clientProposals.length > 0 ? (
                            <Link to={createPageUrl('EditProposal') + `?id=${clientProposals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0].id}`}>
                              <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132]">
                                <FileText className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Proposal</span>
                              </Button>
                            </Link>
                          ) : (
                            <Link to={createPageUrl('CurriculumDesigner') + `?clientId=${client.id}`}>
                              <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132]">
                                <FileText className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Proposal</span>
                              </Button>
                            </Link>
                          )}
                          <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(client.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}