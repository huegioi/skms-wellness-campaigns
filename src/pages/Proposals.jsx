import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, Calendar, DollarSign, Copy, Pencil, Trash2, 
  ArrowUpDown, Filter, Eye, Send, CheckCircle, XCircle, Clock, Bell, Mail, Link2, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import SendProposalDialog from '@/components/proposals/SendProposalDialog';
import SendReminderDialog from '@/components/proposals/SendReminderDialog';

export default function Proposals() {
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingProposal, setViewingProposal] = useState(null);
  const [sendingProposal, setSendingProposal] = useState(null);
  const [reminderProposal, setReminderProposal] = useState(null);

  const queryClient = useQueryClient();

  const { data: proposals = [], isLoading, error } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date'),
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Proposal.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Proposal.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] })
  });

  const duplicateMutation = useMutation({
    mutationFn: async (proposal) => {
      const { id, created_date, updated_date, ...rest } = proposal;
      return base44.entities.Proposal.create({
        ...rest,
        status: 'draft',
        client_name: `${rest.client_name} (Copy)`
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proposals'] })
  });

  const statusConfig = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
    sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
    viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
    accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle }
  };

  // Filter and sort proposals
  const filteredProposals = proposals
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .filter(p => filterClient === 'all' || p.client_id === filterClient)
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.client_name?.toLowerCase().includes(query) ||
        p.company?.toLowerCase().includes(query) ||
        p.client_email?.toLowerCase().includes(query) ||
        p.narrative_summary?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.created_date) - new Date(b.created_date);
      } else if (sortBy === 'amount') {
        comparison = (a.total_amount || 0) - (b.total_amount || 0);
      } else if (sortBy === 'client') {
        comparison = (a.client_name || '').localeCompare(b.client_name || '');
      } else if (sortBy === 'status') {
        comparison = (a.status || 'draft').localeCompare(b.status || 'draft');
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading proposals...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading proposals: {error.message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Proposals</h1>
            <p className="text-gray-600">Manage and track all your proposals</p>
          </div>
          <Link to={createPageUrl('CurriculumDesigner')}>
            <Button className="bg-[#770142] hover:bg-[#5a0132]">
              <FileText className="w-4 h-4 mr-2" /> New Proposal
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl p-4 shadow-lg mb-6 space-y-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search by client name, company, or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">Filters:</span>
            </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
          </div>
          
          {(searchQuery || filterStatus !== 'all' || filterClient !== 'all') && (
            <div className="text-sm text-gray-500">
              Showing {filteredProposals.length} of {proposals.length} proposals
            </div>
          )}
        </div>

        {/* Proposals List */}
        {filteredProposals.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No proposals found</h3>
            <p className="text-gray-500">Create your first proposal or adjust your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProposals.map(proposal => {
              const status = statusConfig[proposal.status || 'draft'];
              const StatusIcon = status.icon;
              
              return (
                <div key={proposal.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>
                            {proposal.client_name}
                          </h3>
                          <Badge className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        {proposal.company && (
                          <p className="text-gray-600 text-sm mb-2">{proposal.company}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(proposal.created_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${proposal.total_amount?.toLocaleString() || 0}
                          </span>
                          {proposal.sent_date && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              Sent: {new Date(proposal.sent_date).toLocaleDateString()}
                            </span>
                          )}
                          {proposal.viewed_date && (
                            <span className="flex items-center gap-1 text-purple-600">
                              <Eye className="w-4 h-4" />
                              Viewed: {new Date(proposal.viewed_date).toLocaleDateString()}
                            </span>
                          )}
                          {proposal.reminder_count > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Bell className="w-4 h-4" />
                              {proposal.reminder_count} reminder(s)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Dropdown */}
                        <Select 
                          value={proposal.status || 'draft'} 
                          onValueChange={(value) => updateStatusMutation.mutate({ id: proposal.id, status: value })}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="viewed">Viewed</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Send/Reminder buttons based on status */}
                        {proposal.status === 'draft' && (
                          <Button size="sm" variant="outline" className="text-[#770142] border-[#770142]" onClick={() => setSendingProposal(proposal)}>
                            <Send className="w-4 h-4 mr-1" /> Send
                          </Button>
                        )}
                        {(proposal.status === 'sent' || proposal.status === 'viewed') && (
                          <Button size="sm" variant="outline" className="text-amber-600 border-amber-600" onClick={() => setReminderProposal(proposal)}>
                            <Bell className="w-4 h-4 mr-1" /> Remind
                          </Button>
                        )}

                        <Button 
                          size="icon" 
                          variant="outline" 
                          title="Copy client portal link"
                          onClick={() => {
                            const url = `${window.location.origin}/ViewProposal?id=${proposal.id}`;
                            navigator.clipboard.writeText(url);
                            alert('Portal link copied! Share this with your client.');
                          }}
                        >
                          <Link2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => setViewingProposal(proposal)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Link to={createPageUrl('EditProposal') + `?id=${proposal.id}`}>
                          <Button size="icon" variant="outline">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button size="icon" variant="outline" onClick={() => duplicateMutation.mutate(proposal)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deleteMutation.mutate(proposal.id)}>
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

        {/* View Proposal Dialog */}
        <Dialog open={!!viewingProposal} onOpenChange={(open) => !open && setViewingProposal(null)}>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Proposal Details</DialogTitle>
            </DialogHeader>
            {viewingProposal && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs sm:text-sm text-gray-500">Client</label>
                    <p className="font-semibold">{viewingProposal.client_name}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm text-gray-500">Company</label>
                    <p className="font-semibold">{viewingProposal.company || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm text-gray-500">Total Amount</label>
                    <p className="font-semibold text-lg" style={{ color: '#770142' }}>
                      ${viewingProposal.total_amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm text-gray-500">Status</label>
                    <Badge className={statusConfig[viewingProposal.status || 'draft'].color}>
                      {statusConfig[viewingProposal.status || 'draft'].label}
                    </Badge>
                  </div>
                </div>

                {/* Email tracking info */}
                {viewingProposal.sent_date && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Email Activity</h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-600">
                        <Mail className="w-4 h-4 inline mr-2" />
                        Sent: {new Date(viewingProposal.sent_date).toLocaleString()}
                        {viewingProposal.client_email && ` to ${viewingProposal.client_email}`}
                      </p>
                      {viewingProposal.viewed_date && (
                        <p className="text-purple-600">
                          <Eye className="w-4 h-4 inline mr-2" />
                          Viewed: {new Date(viewingProposal.viewed_date).toLocaleString()}
                        </p>
                      )}
                      {viewingProposal.reminder_count > 0 && (
                        <p className="text-amber-600">
                          <Bell className="w-4 h-4 inline mr-2" />
                          {viewingProposal.reminder_count} reminder(s) sent
                          {viewingProposal.last_reminder_date && ` (last: ${new Date(viewingProposal.last_reminder_date).toLocaleDateString()})`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {viewingProposal.selections && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Included Items</h4>
                    {viewingProposal.selections.workshops?.length > 0 && (
                      <p className="text-sm text-gray-600">• {viewingProposal.selections.workshops.length} Workshops</p>
                    )}
                    {viewingProposal.selections.challengePrograms?.length > 0 && (
                      <p className="text-sm text-gray-600">• {viewingProposal.selections.challengePrograms.length} Challenges</p>
                    )}
                    {viewingProposal.selections.leadership?.length > 0 && (
                      <p className="text-sm text-gray-600">• {viewingProposal.selections.leadership.length} Leadership Programs</p>
                    )}
                    {viewingProposal.selections.movementClasses?.length > 0 && (
                      <p className="text-sm text-gray-600">• {viewingProposal.selections.movementClasses.length} Classes</p>
                    )}
                    {(() => {
                      const boxes = viewingProposal.selections.wellnessBoxes || viewingProposal.selections.sampleBoxQuantities || {};
                      const totalBoxes = (boxes.reduceStress || 0) + (boxes.relaxationSleep || 0) + (boxes.largeEmotional || 0) + (boxes.largeStressReduction || 0);
                      return totalBoxes > 0 ? <p className="text-sm text-gray-600">• {totalBoxes} Wellness Boxes</p> : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Send Proposal Dialog */}
        {sendingProposal && (
          <SendProposalDialog 
            proposal={sendingProposal} 
            open={!!sendingProposal} 
            onOpenChange={(open) => !open && setSendingProposal(null)}
            onSent={() => queryClient.invalidateQueries({ queryKey: ['proposals'] })}
          />
        )}

        {/* Send Reminder Dialog */}
        {reminderProposal && (
          <SendReminderDialog 
            proposal={reminderProposal} 
            open={!!reminderProposal} 
            onOpenChange={(open) => !open && setReminderProposal(null)}
            onSent={() => queryClient.invalidateQueries({ queryKey: ['proposals'] })}
          />
        )}
      </div>
    </div>
  );
}