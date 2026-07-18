import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getActiveCohort, hasRenewalReviewBooked, daysUntilRenewal } from '@/lib/renewal';

/**
 * Shown during a renewal ramp window: lists cohort clients with no renewal
 * review booked, sorted by days remaining. Rendered inside FollowUpQueue.
 */
export default function RenewalSeasonSection() {
  const { data: rawClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: rawEvents = [] } = useQuery({
    queryKey: ['delivery-events'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 500),
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const clients = rawClients.filter(c => !c.is_demo && !c.is_assessment_lead);
  const events = rawEvents.filter(e => !e.is_demo);

  const activeCohort = useMemo(() => getActiveCohort(), []);

  if (!activeCohort) return null;

  const cohortClients = clients.filter(
    (c) => c.renewal_cohort === activeCohort.label && c.client_stage !== 'churned'
  );

  const noReview = cohortClients
    .filter((c) => !hasRenewalReviewBooked(c, events))
    .map((c) => ({ client: c, days: daysUntilRenewal(c) }))
    .filter((x) => x.days !== null)
    .sort((a, b) => a.days - b.days);

  if (noReview.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-[#770142]/10 to-[#770142]/5 border-[#770142]/30 mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg text-[#770142]">
            <RefreshCw className="w-5 h-5" />
            Renewal season — {activeCohort.label} cohort
          </div>
          <Badge className="bg-[#770142] text-white">
            {noReview.length} need{noReview.length !== 1 ? 's' : ''} a review
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-3">
          {activeCohort.daysRemaining} days until {activeCohort.label}. These clients have no renewal review booked yet.
        </p>
        <div className="space-y-2">
          {noReview.map(({ client, days }) => (
            <div key={client.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{client.company || client.name}</p>
                <p className="text-xs text-gray-500">{client.renewal_cohort} · renews in {days}d</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link to={createPageUrl('Clients') + `?clientId=${client.id}`}>
                  <Button size="sm" variant="outline" className="text-[#013f7c] border-[#013f7c]">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />View
                  </Button>
                </Link>
                <Link to={`/SchedulingHub?clientId=${client.id}`}>
                  <Button size="sm" className="bg-[#770142] hover:bg-[#5a0132]">
                    <CalendarPlus className="w-3.5 h-3.5 mr-1" />Book review
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}