import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar, Mail, Building, Clock, Settings, LogOut, ClipboardList } from 'lucide-react';
import ClientProposalView from '@/components/portal/ClientProposalView';
import ClientTimeline from '@/components/portal/ClientTimeline';
import ClientEmailTemplates from '@/components/portal/ClientEmailTemplates';
import ClientProfileSettings from '@/components/portal/ClientProfileSettings';
import PortalFeedback from '@/components/portal/PortalFeedback';

export default function MyPortal() {
  const [activeTab, setActiveTab] = useState('proposal');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['portalClient', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const clients = await base44.entities.Client.filter({ email: user.email });
      return clients[0] || null;
    },
    enabled: !!user?.email
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['portalProposals', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      return base44.entities.Proposal.filter({ client_id: client.id }, '-created_date');
    },
    enabled: !!client?.id
  });

  const acceptedProposal = proposals.find(p => p.status === 'accepted') || proposals[0];

  // Get services for resolving IDs to names/descriptions
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
  });

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

  const handleLogout = () => {
    base44.auth.logout();
  };

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
          <p className="text-sm text-gray-500 mb-6">Logged in as: {user?.email}</p>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#223d32] text-white py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/abfb649ad_SkillfulMeansWebsiteHero.png" 
                alt="SkillfulMeans" 
                className="h-10 hidden sm:block"
              />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Welcome, {client.name}</h1>
                <p className="text-white/80 text-sm">Empowering your team with mindful wellness programs.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-white/70 hidden md:block">
                <Clock className="w-4 h-4 inline mr-1" />
                {new Date().toLocaleDateString()}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-white hover:bg-white/20"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto mb-8 -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-max min-w-full h-auto p-1 gap-1">
              <TabsTrigger value="proposal" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Proposal</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Emails</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <Settings className="w-4 h-4 shrink-0" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>Feedback</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="proposal">
            <ClientProposalView proposal={acceptedProposal} client={client} services={services} />
          </TabsContent>
          <TabsContent value="timeline">
            <ClientTimeline events={events} proposal={acceptedProposal} />
          </TabsContent>
          <TabsContent value="templates">
            <ClientEmailTemplates proposal={acceptedProposal} />
          </TabsContent>
          <TabsContent value="profile">
            <ClientProfileSettings client={client} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['portalClient'] })} />
          </TabsContent>
          <TabsContent value="feedback">
            <PortalFeedback client={client} proposals={proposals} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="bg-white border-t py-4 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          Need help? Contact us at <a href="mailto:admin@skillfulmeans.life" className="text-[#770142] underline">admin@skillfulmeans.life</a>
        </div>
      </div>
    </div>
  );
}