import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar, Mail, Building, Clock, Settings, Share2, ClipboardList, FolderOpen, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import ClientProposalView from '@/components/portal/ClientProposalView';
import ClientTimeline from '@/components/portal/ClientTimeline';
import ClientEmailTemplates from '@/components/portal/ClientEmailTemplates';
import ClientProfileSettings from '@/components/portal/ClientProfileSettings';
import PortalFeedback from '@/components/portal/PortalFeedback';
import ClientResources from '@/components/portal/ClientResources';
import BookSession from '@/components/portal/BookSession';

export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState('proposal');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const clientIdFromUrl = urlParams.get('clientId');

  const handleSharePortal = () => {
    const portalUrl = window.location.origin + window.location.pathname + (clientIdFromUrl ? `?clientId=${clientIdFromUrl}` : '');
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success('Portal link copied to clipboard!', {
      description: 'Share this link with your client to give them access to their portal.'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Find client - either by URL param (admin view) or by logged-in user email
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['portalClient', clientIdFromUrl, user?.email],
    queryFn: async () => {
      // If clientId in URL, fetch that specific client (admin viewing)
      if (clientIdFromUrl) {
        const clients = await base44.entities.Client.filter({ id: clientIdFromUrl });
        return clients[0] || null;
      }
      // Otherwise, find by logged-in user email
      if (!user?.email) return null;
      const clients = await base44.entities.Client.filter({ email: user.email });
      return clients[0] || null;
    },
    enabled: !!clientIdFromUrl || !!user?.email
  });

  // Get proposals for this client
  const { data: proposals = [] } = useQuery({
    queryKey: ['portalProposals', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      return base44.entities.Proposal.filter({ client_id: client.id }, '-created_date');
    },
    enabled: !!client?.id
  });

  // Get accepted proposal
  const acceptedProposal = proposals.find(p => p.status === 'accepted') || proposals[0];

  // Get events for this client (filter by client_id, client_name, company, or proposal_id)
  const { data: events = [] } = useQuery({
    queryKey: ['portalEvents', client?.id, client?.name, proposals],
    queryFn: async () => {
      if (!client) return [];
      const proposalIds = new Set(proposals.map(p => p.id));
      const allEvents = await base44.entities.CalendarEvent.list('start_date');
      const clientNameLower = client.name?.toLowerCase().trim() || '';
      const clientCompanyLower = client.company?.toLowerCase().trim() || '';
      return allEvents.filter(event => {
        // Must have a client_name on the event OR a matching proposal/client_id
        const eventClientLower = event.client_name?.toLowerCase().trim() || '';

        if (event.client_id && event.client_id === client.id) return true;
        if (event.proposal_id && proposalIds.has(event.proposal_id)) return true;

        // Only do name matching if the event actually has a client_name set
        if (!eventClientLower) return false;

        if (clientNameLower && eventClientLower === clientNameLower) return true;
        if (clientCompanyLower && eventClientLower === clientCompanyLower) return true;

        // Allow partial match only when event client_name is a meaningful substring
        // (covers "Moses Weitzman" matching "Moses Weitzman Health System")
        if (clientNameLower && clientNameLower.length > 5 && clientNameLower.includes(eventClientLower)) return true;
        if (clientNameLower && eventClientLower.length > 5 && eventClientLower.includes(clientNameLower)) return true;
        if (clientCompanyLower && clientCompanyLower.length > 5 && clientCompanyLower.includes(eventClientLower)) return true;
        if (clientCompanyLower && eventClientLower.length > 5 && eventClientLower.includes(clientCompanyLower)) return true;

        return false;
      });
    },
    enabled: !!client
  });

  // Get email templates
  const { data: allTemplates = [] } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list()
  });

  // Get services for resolving IDs to names/descriptions
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

  if (clientLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#770142] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <Building className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-4">
            Your client portal is being set up. Please contact us if you believe this is an error.
          </p>
          <p className="text-sm text-gray-500">Logged in as: {user?.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#264d44] to-[#013f7c] text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Welcome, {client.name}</h1>
              <p className="text-white/80 mt-1">{client.company || 'Your Wellness Portal'}</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSharePortal}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Share2 className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Share Portal'}
              </Button>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Clock className="w-4 h-4" />
                Last updated: {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto mb-8 -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-max min-w-full h-auto p-1 gap-1">
              <TabsTrigger value="proposal" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Programming</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="book" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <CalendarPlus className="w-4 h-4 shrink-0" />
                <span>Book</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Emails</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <Settings className="w-4 h-4 shrink-0" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span>Resources</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>Feedback</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="proposal">
            <ClientProposalView proposals={proposals} client={client} services={services} />
          </TabsContent>
          <TabsContent value="timeline">
            <ClientTimeline events={events} proposal={acceptedProposal} />
          </TabsContent>
          <TabsContent value="book">
            <BookSession client={client} />
          </TabsContent>
          <TabsContent value="templates">
            <ClientEmailTemplates proposal={acceptedProposal} templates={allTemplates} client={client} />
          </TabsContent>
          <TabsContent value="profile">
            <ClientProfileSettings client={client} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['portalClient'] })} />
          </TabsContent>
          <TabsContent value="resources">
            <ClientResources client={client} />
          </TabsContent>
          <TabsContent value="feedback">
            <PortalFeedback client={client} proposals={proposals} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}