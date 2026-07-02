import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Building2, Mail, Phone, Copy, Check, Link2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function ClientPortalCard({ client, stats }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);

  const hasAcceptedProposal = stats?.hasAcceptedProposal;
  const upcomingCount = stats?.upcomingCount || 0;
  const hasToken = !!client.portal_token;

  const handleCopyLink = async () => {
    setLoadingToken(true);
    try {
      const res = await base44.functions.invoke('generateClientPortalToken', { client_id: client.id });
      const token = res.data?.portal_token;
      if (!token) throw new Error('No token returned');
      const url = `${window.location.origin}/ClientPortal?token=${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: `Portal link copied for ${client.company || client.name}` });
    } catch (e) {
      toast({ title: 'Failed to copy link', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingToken(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{client.name}</div>
            {client.company && (
              <div className="text-sm font-normal text-gray-600 mt-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {client.company}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-3">
          {client.email && (
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <Mail className="w-3 h-3" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <Phone className="w-3 h-3" />
              {client.phone}
            </div>
          )}
        </div>

        {/* Chips row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hasAcceptedProposal ? (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Proposal ✓
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              No proposal
            </span>
          )}
          {upcomingCount > 0 ? (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {upcomingCount} upcoming
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              No sessions
            </span>
          )}
          {hasToken ? (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <Link2 className="w-3 h-3 mr-0.5" />
              Link active
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              No link
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to={createPageUrl('ClientPortal') + `?clientId=${client.id}`}>
            <Button className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Portal
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleCopyLink}
            disabled={loadingToken}
          >
            {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {loadingToken ? 'Copying…' : copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}