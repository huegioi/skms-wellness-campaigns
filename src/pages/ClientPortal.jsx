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
  const token = urlParams.get('token');
  const clientIdFromUrl = urlParams.get('clientId');

  const handleSharePortal = () => {
    const tokenToShare = token || client?.portal_token;
    if (!tokenToShare) return;
    const portalUrl = `${window.location.origin}/ClientPortal?token=${tokenToShare}`;
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

  const { data: portalData, isLoading: clientLoading } = useQuery({
    queryKey: ['clientPortalData', token || clientIdFromUrl],
    queryFn: async () => {
      try {
        const payload = token ? { token } : { client_id: clientIdFromUrl };
        const res = await base44.functions.invoke('getClientPortalData', payload);
        return res.data;
      } catch (e) {
        if (e?.response?.status === 404 || e?.response?.status === 403) return null;
        throw e;
      }
    },
    enabled: !!token || !!clientIdFromUrl
  });

  const client = portalData?.client || null;
  const proposals = portalData?.proposals || [];
  const events = portalData?.events || [];
  const allTemplates = portalData?.email_templates || [];
  const services = portalData?.services || [];

  // Get accepted proposal
  const acceptedProposal = proposals.find(p => p.status === 'accepted') || proposals[0];

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

  const latestUpdate = [client?.updated_date, ...proposals.map(p => p.updated_date), ...events.map(e => e.updated_date)]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#223d32] text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png" 
                alt="SkillfulMeans" 
                className="h-10 hidden sm:block"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Welcome, {client.name}</h1>
                <p className="text-white/80 mt-1">Empowering your team with mindful wellness programs.</p>
              </div>
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
              {latestUpdate && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="w-4 h-4" />
                  Last updated: {new Date(latestUpdate).toLocaleDateString()}
                </div>
              )}
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
            <ClientProfileSettings client={client} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['clientPortalData'] })} />
          </TabsContent>
          <TabsContent value="resources">
            <ClientResources client={client} proposals={proposals} services={services} />
          </TabsContent>
          <TabsContent value="feedback">
            <PortalFeedback client={client} proposals={proposals} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}