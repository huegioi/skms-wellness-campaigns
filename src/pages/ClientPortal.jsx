import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar, Mail, Building, Clock, Settings, Share2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import ClientProposalView from '@/components/portal/ClientProposalView';
import ClientTimeline from '@/components/portal/ClientTimeline';
import ClientEmailTemplates from '@/components/portal/ClientEmailTemplates';
import ClientProfileSettings from '@/components/portal/ClientProfileSettings';
import PortalFeedback from '@/components/portal/PortalFeedback';

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

  // Get events for this client (filter by client_id OR client_name)
  const { data: events = [] } = useQuery({
    queryKey: ['portalEvents', client?.id, client?.name],
    queryFn: async () => {
      if (!client) return [];
      // Get events by client_id OR client_name to catch all related events
      const allEvents = await base44.entities.CalendarEvent.list('start_date');
      return allEvents.filter(event => 
        event.client_id === client.id || event.client_name === client.name || event.client_name === client.company
      );
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
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="proposal" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">My Wellness Programming</span>
              <span className="sm:hidden">Programming</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Event Timeline</span>
              <span className="sm:hidden">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email Templates</span>
              <span className="sm:hidden">Emails</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">My Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Feedback</span>
              <span className="sm:hidden">Feedback</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proposal">
            <ClientProposalView proposals={proposals} client={client} services={services} />
          </TabsContent>

          <TabsContent value="timeline">
            <ClientTimeline events={events} proposal={acceptedProposal} />
          </TabsContent>

          <TabsContent value="templates">
            <ClientEmailTemplates proposal={acceptedProposal} templates={allTemplates} client={client} />
          </TabsContent>

          <TabsContent value="profile">
            <ClientProfileSettings client={client} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['portalClient'] })} />
          </TabsContent>

          <TabsContent value="feedback">
            <PortalFeedback client={client} proposals={proposals} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}