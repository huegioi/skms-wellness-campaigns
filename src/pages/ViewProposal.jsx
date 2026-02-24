import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar, Mail, Clock } from 'lucide-react';
import ClientProposalView from '@/components/portal/ClientProposalView';
import ClientTimeline from '@/components/portal/ClientTimeline';
import ClientEmailTemplates from '@/components/portal/ClientEmailTemplates';

export default function ViewProposal() {
  const [activeTab, setActiveTab] = useState('proposal');
  
  const urlParams = new URLSearchParams(window.location.search);
  const proposalId = urlParams.get('id');

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!proposalId) {
      setIsLoading(false);
      return;
    }
    
    // Use direct fetch to avoid SDK auth requirements
    const fetchProposal = async () => {
      try {
        // Get the base URL from window location
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/api/functions/getPublicProposal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Proposal data received:', result);
        setData(result);
      } catch (err) {
        console.error('Error fetching proposal:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProposal();
  }, [proposalId]);

  const proposal = data?.proposal;
  const client = data?.client;
  const events = data?.events || [];
  const templates = data?.templates || [];
  const services = data?.services || [];

  if (!proposalId) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Link</h2>
          <p className="text-gray-600">This proposal link is invalid. Please check the URL or contact us for assistance.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#770142] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your proposal...</p>
        </div>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Proposal</h2>
          <p className="text-gray-600">{error || data?.error}</p>
          <p className="text-xs text-gray-400 mt-2">ID: {proposalId}</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Proposal Not Found</h2>
          <p className="text-gray-600">This proposal may have been removed or the link is incorrect.</p>
          <p className="text-xs text-gray-400 mt-2">ID: {proposalId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#264d44] to-[#013f7c] text-white py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/abfb649ad_SkillfulMeansWebsiteHero.png" 
                alt="SkillfulMeans" 
                className="h-10 hidden sm:block"
              />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">
                  {proposal.client_name ? `Welcome, ${proposal.client_name}` : 'Your Wellness Proposal'}
                </h1>
                <p className="text-white/80 text-sm">{proposal.company || client?.company || 'SkillfulMeans Wellness Program'}</p>
              </div>
            </div>
            <div className="text-sm text-white/70">
              <Clock className="w-4 h-4 inline mr-1" />
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="proposal" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">My Proposal</span>
              <span className="sm:hidden">Proposal</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Timeline</span>
              <span className="sm:hidden">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Email Templates</span>
              <span className="sm:hidden">Emails</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proposal">
            <ClientProposalView proposal={proposal} client={client} />
          </TabsContent>

          <TabsContent value="timeline">
            <ClientTimeline events={events} proposal={proposal} />
          </TabsContent>

          <TabsContent value="templates">
            <ClientEmailTemplates proposal={proposal} templates={templates} />
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