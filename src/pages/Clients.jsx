import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, User, Building, Mail, Phone, FileText, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Clients() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', phone: '', notes: '' });
  
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
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });

  const resetForm = () => setFormData({ name: '', email: '', company: '', phone: '', notes: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (client) => {
    setFormData({ name: client.name, email: client.email, company: client.company || '', phone: client.phone || '', notes: client.notes || '' });
    setEditingClient(client);
  };

  const getClientProposals = (clientId) => proposals.filter(p => p.client_id === clientId);

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700'
  };

  if (clientsLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Clients</h1>
            <p className="text-gray-600">Manage your clients and their proposals</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#264d44] hover:bg-[#1a3830]" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <Input placeholder="Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                <Input placeholder="Company" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} />
                <Input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                <Textarea placeholder="Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">Add Client</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <Input placeholder="Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              <Input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              <Input placeholder="Company" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} />
              <Input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <Textarea placeholder="Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              <Button type="submit" className="w-full bg-[#264d44] hover:bg-[#1a3830]">Save Changes</Button>
            </form>
          </DialogContent>
        </Dialog>

        {clients.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No clients yet</h3>
            <p className="text-gray-500 mb-4">Add your first client to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map(client => {
              const clientProposals = getClientProposals(client.id);
              const isExpanded = expandedClient === client.id;
              
              return (
                <div key={client.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>{client.name}</h3>
                          {clientProposals.length > 0 && (
                            <Badge variant="outline">{clientProposals.length} proposal{clientProposals.length !== 1 ? 's' : ''}</Badge>
                          )}
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
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={createPageUrl('CurriculumDesigner') + `?clientId=${client.id}`}>
                          <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132]">
                            <FileText className="w-4 h-4 mr-1" /> New Proposal
                          </Button>
                        </Link>
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(client)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(client.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {clientProposals.length > 0 && (
                          <Button size="icon" variant="ghost" onClick={() => setExpandedClient(isExpanded ? null : client.id)}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && clientProposals.length > 0 && (
                    <div className="border-t bg-gray-50 p-4">
                      <h4 className="font-semibold text-sm mb-3 text-gray-700">Proposals</h4>
                      <div className="space-y-2">
                        {clientProposals.map(proposal => (
                          <div key={proposal.id} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                            <div>
                              <span className="font-medium">${proposal.total_amount?.toLocaleString()}</span>
                              <span className="text-gray-500 text-sm ml-3">
                                {new Date(proposal.created_date).toLocaleDateString()}
                              </span>
                            </div>
                            <Badge className={statusColors[proposal.status || 'draft']}>
                              {proposal.status || 'draft'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}