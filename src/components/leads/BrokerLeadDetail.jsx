import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Mail, Phone, User, Star, ExternalLink, DollarSign, FileText } from 'lucide-react';
import GmailHistory from '@/components/clients/GmailHistory';

const STATUS_CONFIG = {
  cold:               { label: 'Cold',              color: 'bg-slate-100 text-slate-700 border-slate-300' },
  contacted:          { label: 'Contacted',          color: 'bg-blue-100 text-blue-700 border-blue-300' },
  responded:          { label: 'Responded',          color: 'bg-purple-100 text-purple-700 border-purple-300' },
  meeting_scheduled:  { label: 'Meeting Scheduled',  color: 'bg-amber-100 text-amber-700 border-amber-300' },
  proposal_sent:      { label: 'Proposal Sent',      color: 'bg-orange-100 text-orange-700 border-orange-300' },
  converted:          { label: 'Converted ✓',        color: 'bg-green-100 text-green-700 border-green-300' },
  not_interested:     { label: 'Not Interested',     color: 'bg-red-100 text-red-700 border-red-300' },
  current_client:     { label: 'Current Client',     color: 'bg-teal-100 text-teal-800 border-teal-400' },
};

const PARTNER_STATUS_CONFIG = {
  new:            { label: 'New',            color: 'bg-slate-100 text-slate-700' },
  nurturing:      { label: 'Nurturing',      color: 'bg-blue-100 text-blue-700' },
  active_partner: { label: 'Active Partner', color: 'bg-green-100 text-green-700' },
  inactive:       { label: 'Inactive',       color: 'bg-red-100 text-red-700' },
};

const PROPOSAL_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
};

export default function BrokerLeadDetail({ lead, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Find clients that reference this broker by email
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: allProposals = [] } = useQuery({
    queryKey: ['allProposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date')
  });

  // Clients that list this broker
  const relatedClients = allClients.filter(c =>
    c.broker_email?.toLowerCase() === lead.email?.toLowerCase() ||
    c.wellness_consultant_email?.toLowerCase() === lead.email?.toLowerCase()
  );

  const relatedClientIds = new Set(relatedClients.map(c => c.id));

  // Proposals linked to any of those clients
  const relatedProposals = allProposals.filter(p => relatedClientIds.has(p.client_id));

  const totalProposalValue = relatedProposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const acceptedProposals = relatedProposals.filter(p => p.status === 'accepted');
  const acceptedValue = acceptedProposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);

  const statusCfg = STATUS_CONFIG[lead.status || 'cold'] || STATUS_CONFIG.cold;
  const partnerCfg = PARTNER_STATUS_CONFIG[lead.partner_status || 'new'] || PARTNER_STATUS_CONFIG.new;

  const sourceParts = (lead.source || '').split(' | ');
  const linkedinUrl = sourceParts[1] || '';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-[#013f7c]">{lead.name}</DialogTitle>
              {(lead.title || lead.company) && (
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                  {lead.title && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{lead.title}</span>}
                  {lead.company && <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" />{lead.company}</span>}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                <Badge variant="outline" className={`text-xs ${partnerCfg.color}`}>{partnerCfg.label}</Badge>
                {(lead.referral_count || 0) > 0 && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    <Star className="w-3 h-3 mr-1" />{lead.referral_count} referral{lead.referral_count !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50 border-b flex-shrink-0">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#013f7c]">{relatedClients.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Companies</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-700">{relatedProposals.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Proposals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">${acceptedValue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Won Value</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="w-full rounded-none border-b bg-white px-6 justify-start h-10 gap-1">
              <TabsTrigger value="overview" className="text-sm">Overview</TabsTrigger>
              <TabsTrigger value="companies" className="text-sm">
                Companies ({relatedClients.length})
              </TabsTrigger>
              <TabsTrigger value="proposals" className="text-sm">
                Proposals ({relatedProposals.length})
              </TabsTrigger>
              <TabsTrigger value="emails" className="text-sm">Emails</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="p-6 space-y-4 mt-0">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 text-sm">Contact Info</h4>
                  {lead.email && <p className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-400" />{lead.email}</p>}
                  {lead.phone && <p className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" />{lead.phone}</p>}
                  {linkedinUrl && (
                    <a href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                      <ExternalLink className="w-4 h-4" />LinkedIn
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 text-sm">Details</h4>
                  {lead.industry && <p className="text-sm"><Badge variant="outline">{lead.industry}</Badge></p>}
                  {lead.last_contacted_date && <p className="text-sm text-gray-600">Last contacted: {new Date(lead.last_contacted_date).toLocaleDateString()}</p>}
                  {lead.next_followup_date && <p className="text-sm text-amber-600">Follow-up: {new Date(lead.next_followup_date).toLocaleDateString()}</p>}
                  {lead.last_referral_date && <p className="text-sm text-purple-600">Last referral: {new Date(lead.last_referral_date).toLocaleDateString()}</p>}
                </div>
              </div>
              {lead.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 text-sm mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </TabsContent>

            {/* Companies */}
            <TabsContent value="companies" className="p-6 mt-0">
              {relatedClients.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Building className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>No companies linked to this broker yet.</p>
                  <p className="text-xs mt-1">Link a broker to a client via the Clients page.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relatedClients.map(client => {
                    const clientProposals = allProposals.filter(p => p.client_id === client.id);
                    const clientTotal = clientProposals.reduce((s, p) => s + (p.total_amount || 0), 0);
                    const clientWon = clientProposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.total_amount || 0), 0);
                    const isBroker = client.broker_email?.toLowerCase() === lead.email?.toLowerCase();
                    return (
                      <div key={client.id} className="bg-white border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-800">{client.name}</p>
                              {client.company && <span className="text-sm text-gray-500">— {client.company}</span>}
                              <Badge variant="outline" className={`text-xs ${isBroker ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                {isBroker ? 'Broker' : 'Wellness Consultant'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>
                            {client.industry && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mt-1 inline-block">{client.industry}</span>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-green-600">${clientWon.toLocaleString()} won</p>
                            <p className="text-xs text-gray-400">${clientTotal.toLocaleString()} total</p>
                            <p className="text-xs text-gray-400">{clientProposals.length} proposal{clientProposals.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Proposals */}
            <TabsContent value="proposals" className="p-6 mt-0">
              {relatedProposals.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  <p>No proposals linked to this broker's companies yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Total Pipeline</p>
                      <p className="text-xl font-bold text-[#013f7c]">${totalProposalValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Won ({acceptedProposals.length})</p>
                      <p className="text-xl font-bold text-green-700">${acceptedValue.toLocaleString()}</p>
                    </div>
                  </div>

                  {relatedProposals.map(proposal => {
                    const client = allClients.find(c => c.id === proposal.client_id);
                    return (
                      <div key={proposal.id} className="bg-white border rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-800">${proposal.total_amount?.toLocaleString()}</p>
                            {client && <p className="text-sm text-gray-500">{client.name}{client.company ? ` — ${client.company}` : ''}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">Created: {new Date(proposal.created_date).toLocaleDateString()}</p>
                          </div>
                          <Badge className={`text-xs ${PROPOSAL_STATUS_COLORS[proposal.status || 'draft']}`}>
                            {(proposal.status || 'draft').charAt(0).toUpperCase() + (proposal.status || 'draft').slice(1)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Emails */}
            <TabsContent value="emails" className="p-6 mt-0">
              <GmailHistory clientEmail={lead.email} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}