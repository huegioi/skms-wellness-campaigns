import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import ClientsSubNav from '@/components/clients/ClientsSubNav.jsx';
import ClientPortalCard from '@/components/clients/ClientPortalCard.jsx';

export default function ManageClientPortals() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name')
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date', 500)
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: () => base44.entities.CalendarEvent.filter({ completed: false }, 'start_date', 500)
  });

  const statsByClient = useMemo(() => {
    const now = new Date().toISOString();
    const acceptedByClient = new Set(
      proposals.filter(p => p.status === 'accepted' && p.client_id).map(p => p.client_id)
    );
    const futureByClient = {};
    for (const e of upcomingEvents) {
      if (e.client_id && e.start_date && e.start_date >= now) {
        futureByClient[e.client_id] = (futureByClient[e.client_id] || 0) + 1;
      }
    }
    const map = {};
    for (const c of clients) {
      map[c.id] = {
        hasAcceptedProposal: acceptedByClient.has(c.id),
        upcomingCount: futureByClient[c.id] || 0,
      };
    }
    return map;
  }, [clients, proposals, upcomingEvents]);

  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(query) ||
      client.company?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-gray-600">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      <ClientsSubNav activePage="ManageClientPortals" />
      <div className="max-w-6xl mx-auto p-4 md:p-8">

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, company, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchQuery && (
              <p className="mt-3 text-sm text-gray-500">
                Showing {filteredClients.length} of {clients.length} clients
              </p>
            )}
          </CardContent>
        </Card>

        {/* Client List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <ClientPortalCard
              key={client.id}
              client={client}
              stats={statsByClient[client.id]}
            />
          ))}
        </div>

        {filteredClients.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                {searchQuery ? 'No clients found matching your search.' : 'No clients yet.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}