import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ExternalLink, ArrowRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getFollowUpReason, needsFollowUp } from '@/lib/followUpLogic';

/**
 * Compact follow-up queue summary for the Overview tab.
 * Shows top 5 clients needing follow-up, with a "View all" button
 * that switches to the Clients tab when there are more.
 */
export default function FollowUpSummary({ onViewAll }) {
  const { data: rawClients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const clients = rawClients.filter(c => !c.is_demo);
  const allQueueClients = clients.filter(needsFollowUp);
  const queueClients = allQueueClients.slice(0, 5);
  const totalCount = allQueueClients.length;

  if (isLoading) return null;

  if (totalCount === 0) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-800">
            <Bell className="w-5 h-5" />
            Follow-Up Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700 text-sm">All clients are up to date — no follow-ups needed right now! 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg text-amber-800">
            <Bell className="w-5 h-5" />
            Follow-Up Queue
          </div>
          <Badge className="bg-amber-500 text-white">{totalCount} client{totalCount !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {queueClients.map(client => {
            const reason = getFollowUpReason(client);
            const ReasonIcon = reason?.icon || AlertTriangle;
            return (
              <div key={client.id} className={`bg-white rounded-lg border p-3 flex items-center gap-3 ${reason?.bg || 'border-gray-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{client.name}</p>
                    {client.company && (
                      <span className="text-gray-500 text-xs">{client.company}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {reason && (
                      <Badge variant="outline" className={`text-xs ${reason.color} border-current`}>
                        <ReasonIcon className="w-3 h-3 mr-1" />
                        {reason.label}
                      </Badge>
                    )}
                    {client.last_service_date && (
                      <span className="text-xs text-gray-500">Last service: {new Date(client.last_service_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <Link to={createPageUrl('Clients') + `?clientId=${client.id}`} className="flex-shrink-0">
                  <Button size="sm" variant="outline" className="text-xs">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
        {totalCount > 5 && (
          <Button variant="ghost" className="w-full mt-3 text-amber-700 hover:bg-amber-100" onClick={onViewAll}>
            View all ({totalCount}) <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}