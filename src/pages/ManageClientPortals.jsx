import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ExternalLink, Building2, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ClientsSubNav from '@/components/clients/ClientsSubNav.jsx';

export default function ManageClientPortals() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name')
  });

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
            <Card key={client.id} className="hover:shadow-lg transition-shadow">
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
                <div className="space-y-2 mb-4">
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

                <Link to={createPageUrl('ClientPortal') + `?clientId=${client.id}`}>
                  <Button className="w-full bg-[#264d44] hover:bg-[#1a3830]">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Portal
                  </Button>
                </Link>
              </CardContent>
            </Card>
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