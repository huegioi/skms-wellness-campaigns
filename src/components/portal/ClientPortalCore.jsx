import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Mail, Building, Clock, Settings, Share2, ClipboardList, FolderOpen, CalendarPlus, LayoutDashboard, ArrowLeft, AlertCircle, UserCheck } from 'lucide-react';
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
import ClientEngagementTab from '@/components/portal/ClientEngagementTab';
import { copyToClipboard } from '@/lib/copyToClipboard';
import PortalLinkDialog from '@/components/shared/PortalLinkDialog';

/**
 * Shared client portal UI driven by mode.
 * mode="admin"  — uses clientId credential, shows Share Portal button
 * mode="client" — uses token credential, shows footer contact strip
 */
export default function ClientPortalCore({ mode, token, clientId }) {
  const [activeTab, setActiveTab] = useState('home');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [portalError, setPortalError] = useState(null); // null | 'not_found' | 'server_error'
  const [linkDialog, setLinkDialog] = useState(null);
  const queryClient = useQueryClient();

  const credential = mode === 'client' ? token : clientId;

  const handleSharePortal = async () => {
    setSharing(true);
    try {
      const res = await base44.functions.invoke('generateClientPortalToken', { client_id: client.id });
      const portalUrl = `${window.location.origin}/ClientPortal?token=${res.data.portal_token}`;
      const ok = await copyToClipboard(portalUrl);
      if (ok) {
        setCopied(true);
        toast.success('Portal link copied', {
          description: `Anyone with this link can view ${client.company || client.name}'s portal.`
        });
        setTimeout(() => setCopied(false), 2000);
      } else {
        setLinkDialog({ url: portalUrl, clientName: client.company || client.name });
      }
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
        const status = e?.response?.status;
        if (status === 403) {
          setPortalError('forbidden');
          return null;
        }
        if (status === 404) {
          setPortalError('not_found');
          return null;
        }
        setPortalError('server_error');
        return null;
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
  const checkins = portalData?.checkins || [];
  const acceptedProposal = proposals.find(p => p.status === 'accepted') || proposals[0];

  const portalTabs = [
    { key: 'home', label: 'Home', icon: LayoutDashboard },
    { key: 'proposal', label: 'Programming', icon: FileText },
    { key: 'timeline', label: 'Timeline', icon: Calendar },
    { key: 'book', label: 'Book', icon: CalendarPlus },
    { key: 'templates', label: 'Emails', icon: Mail },
    { key: 'profile', label: 'Profile', icon: Settings },
    { key: 'resources', label: 'Resources', icon: FolderOpen },
    { key: 'feedback', label: 'Feedback', icon: ClipboardList },
    { key: 'engagement', label: 'Engagement', icon: UserCheck },
  ];

  if (clientLoading) {
    return <PortalLoading accentColor="#223d32" label="Loading your portal..." />;
  }

  if (!client) {
    // Admin mode + 403 — a client holding an old ?clientId= link
    if (mode === 'admin' && portalError === 'forbidden') {
      return (
        <PortalError
          icon={Building}
          iconClass="w-16 h-16 text-gray-300"
          heading="Link Outdated"
          message="This portal link is outdated — please contact SkillfulMeans for your new personal link."
        />
      );
    }
    // Admin preview mode — never strand the admin without a way back
    if (mode === 'admin') {
      return (
        <PortalError
          icon={Building}
          iconClass="w-16 h-16 text-gray-300"
          heading="Portal Unavailable"
          message="This portal could not be loaded — the client record may have been merged, deleted, or the link is outdated."
          action={
            <Link to="/ManageClientPortals">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Client Portals
              </Button>
            </Link>
          }
        />
      );
    }
    // Client-facing (token) visits — distinguish error types
    if (portalError === 'not_found') {
      return (
        <PortalError
          icon={Building}
          iconClass="w-16 h-16 text-gray-300"
          heading="Link Not Found"
          message="Portal link not found or expired."
        />
      );
    }
    if (portalError === 'server_error') {
      return (
        <PortalError
          icon={AlertCircle}
          iconClass="w-16 h-16 text-red-400"
          heading="Temporary Error"
          message="Temporary error loading the portal — please refresh."
        />
      );
    }
    // No error, just no data yet — keep the friendly "being set up" message
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
      title={`${client.company || client.name}`}

      maxWidth="max-w-6xl"
      headerPadding="py-8 px-4"
      logoClass="h-10 hidden sm:block"
      titleClass="text-2xl md:text-3xl font-bold"
      contentClass="p-4 md:p-8"
      headerRight={
        <>
          {mode === 'admin' && (
            <Button
              onClick={handleSharePortal}
              variant="outline"
              disabled={sharing}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {sharing ? 'Generating...' : copied ? 'Copied!' : 'Share Portal'}
            </Button>
          )}
          {latestUpdate && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
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
      tabs={portalTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'home' && (
        <ClientHomeTab
          events={events}
          proposals={proposals}
          stats={stats}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === 'proposal' && (
        <ClientProposalView proposals={proposals} client={client} services={services} />
      )}
      {activeTab === 'timeline' && (
        <ClientTimeline events={events} proposal={acceptedProposal} />
      )}
      {activeTab === 'book' && (
        <BookSession client={client} />
      )}
      {activeTab === 'templates' && (
        <ClientEmailTemplates proposal={acceptedProposal} templates={allTemplates} client={client} services={services} />
      )}
      {activeTab === 'profile' && (
        <ClientProfileSettings client={client} token={token} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['clientPortalData'] })} />
      )}
      {activeTab === 'resources' && (
        <ClientResources client={client} proposals={proposals} services={services} />
      )}
      {activeTab === 'feedback' && (
        <PortalFeedback client={client} proposals={proposals} />
      )}
      {activeTab === 'engagement' && (
        <ClientEngagementTab client={client} events={events} checkins={checkins} />
      )}
      <PortalLinkDialog
        url={linkDialog?.url}
        clientName={linkDialog?.clientName}
        open={!!linkDialog}
        onClose={() => setLinkDialog(null)}
      />
      </PortalShell>
    );
  }