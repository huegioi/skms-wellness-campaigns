import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, MapPin, User, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SchedulingHub() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['schedule'],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncGoogleSheetSchedule', {});
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const events = data?.events || [];
  const lastUpdated = data?.lastUpdated;

  // Filter events based on search
  const filteredEvents = events.filter(event => {
    const searchLower = searchTerm.toLowerCase();
    return Object.values(event).some(value => 
      String(value).toLowerCase().includes(searchLower)
    );
  });

  // Get all unique headers for display
  const headers = events.length > 0 ? Object.keys(events[0]) : [];

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
                Scheduling Hub
              </h1>
              <p className="text-gray-600">
                Real-time sync with Google Sheets • Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <a 
                href="https://docs.google.com/spreadsheets/d/1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0/edit" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button className="bg-[#264d44] hover:bg-[#1a3830] gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Sheet
                </Button>
              </a>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search schedule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-[#264d44] border-t-transparent rounded-full"></div>
          </div>
        )}

        {/* Schedule Data */}
        {!isLoading && events.length === 0 && (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Schedule Data</h3>
            <p className="text-gray-500">
              The Google Sheet is empty or hasn't been synced yet.
            </p>
          </Card>
        )}

        {!isLoading && filteredEvents.length > 0 && (
          <div className="space-y-4">
            {filteredEvents.map((event, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {headers.map(header => (
                    <div key={header}>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        {header}
                      </p>
                      <p className="text-sm text-gray-800">
                        {event[header] || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && events.length > 0 && filteredEvents.length === 0 && (
          <Card className="p-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Results</h3>
            <p className="text-gray-500">
              No schedule items match your search.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}