import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar, Mail, Building, Clock, Settings, Share2, ClipboardList, FolderOpen, CalendarPlus, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import ClientProposalView from '@/components/portal/ClientProposalView';
import ClientTimeline from '@/components/portal/ClientTimeline';
import ClientEmailTemplates from '@/components/portal/ClientEmailTemplates';
import ClientProfileSettings from '@/components/portal/ClientProfileSettings';
import PortalFeedback from '@/components/portal/PortalFeedback';
import ClientResources from '@/components/portal/ClientResources';
import BookSession from '@/components/portal/BookSession';
import { PortalShell, PortalLoading, PortalError } from '@/components/portal/PortalShell';
import ClientHomeTab from '@/components/portal/ClientHomeTab';

/**
 * Shared client portal UI driven by mode.
 * mode="admin"  — uses clientId credential, shows Share Portal button
 * mode="client" — uses token credential, shows footer contact strip
 */
export default function ClientPortalCore({ mode, token, clientId }) {
  const [activeTab, setActiveTab] = useState('home');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const queryClient = useQueryClient();

  const credential = mode === 'client' ? token : clientId;

  const handleSharePortal = async () => {
    setSharing(true);
    try {
      const res = await base44.functions.invoke('generateClientPortalToken', { client_id: client.id });
      const portalUrl = `${window.location.origin}/ClientPortal?token=${res.data.portal_token}`;
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success('Portal link copied', {
        description: `Anyone with this link can view ${client.company || client.name}'s portal.`
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Could not generate portal link', {
        description: 'Please try again or contact support.'
      });
    } finally {
      setSharing(false);
    }
  };

  const { data: portalData, isLoading: clientLoading } = useQuery({
    queryKey: ['clientPortalData', credential],
    queryFn: async () => {
      try {
        const payload = mode === 'client' ? { token } : { client_id: clientId };
        const res = await base44.functions.invoke('getClientPortalData', payload);
        return res.data;
      } catch (e) {
        if (e?.response?.status === 404 || e?.response?.status === 403) return null;
        throw e;
      }
    },
    enabled: !!credential
  });

  const client = portalData?.client || null;
  const proposals = portalData?.proposals || [];
  const events = portalData?.events || [];
  const allTemplates = portalData?.email_templates || [];
  const services = portalData?.services || [];
  const stats = portalData?.stats || null;
  const acceptedProposal = proposals.find(p => p.status === 'accepted') || proposals[0];

  if (clientLoading) {
    return <PortalLoading accentColor="#223d32" label="Loading your portal..." />;
  }

  if (!client) {
    return (
      <PortalError
        icon={Building}
        iconClass="w-16 h-16 text-gray-300"
        heading="Welcome!"
        message="Your client portal is being set up. Please contact us if you believe this is an error."
      />
    );
  }

  const latestUpdate = [client?.updated_date, ...proposals.map(p => p.updated_date), ...events.map(e => e.updated_date)]
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return (
    <PortalShell
      accentColor="#223d32"
      title={`Welcome, ${client.name}`}
      subtitle="Empowering your team with mindful wellness programs."
      maxWidth="max-w-6xl"
      headerPadding="py-8 px-4"
      logoClass="h-10 hidden sm:block"
      titleClass="text-2xl md:text-3xl font-bold"
      subtitleClass="text-white/80"
      contentClass="p-4 md:p-8"
      headerRight={
        <>
          {mode === 'admin' && (
            <Button
              onClick={handleSharePortal}
              variant="outline"
              disabled={sharing}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {sharing ? 'Generating...' : copied ? 'Copied!' : 'Share Portal'}
            </Button>
          )}
          {latestUpdate && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Clock className="w-4 h-4" />
              Last updated: {new Date(latestUpdate).toLocaleDateString()}
            </div>
          )}
        </>
      }
      footer={mode === 'client' && (
        <div className="bg-white border-t py-4 mt-8">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
            Need help? Contact us at <a href="mailto:admin@skillfulmeans.life" className="text-brand-plum underline">admin@skillfulmeans.life</a>
          </div>
        </div>
      )}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto mb-8 -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-max min-w-full h-auto p-1 gap-1">
              <TabsTrigger value="home" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-w-[70px]">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Home</span>
              </TabsTrigger>
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

          <TabsContent value="home">
            <ClientHomeTab
              events={events}
              proposals={proposals}
              stats={stats}
              onNavigate={setActiveTab}
            />
          </TabsContent>
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
            <ClientEmailTemplates proposal={acceptedProposal} templates={allTemplates} client={client} services={services} />
          </TabsContent>
          <TabsContent value="profile">
            <ClientProfileSettings client={client} token={token} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['clientPortalData'] })} />
          </TabsContent>
          <TabsContent value="resources">
            <ClientResources client={client} proposals={proposals} services={services} />
          </TabsContent>
          <TabsContent value="feedback">
            <PortalFeedback client={client} proposals={proposals} />
          </TabsContent>
        </Tabs>
      </PortalShell>
    );
  }