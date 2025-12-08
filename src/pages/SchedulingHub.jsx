import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, Clock, MapPin, Users } from 'lucide-react';

export default function SchedulingHub() {
  const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schedule', SPREADSHEET_ID],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncGoogleSheets', {
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1'
      });
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true
  });

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#013f7c' }} />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Schedule</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <Button onClick={handleManualRefresh}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  const scheduleData = data?.data || [];
  const headers = data?.headers || [];

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
              Scheduling Hub
            </h1>
            <p className="text-gray-600">
              Real-time sync with Google Sheets • Auto-updates every 30 seconds
            </p>
          </div>
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            className="flex items-center gap-2"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Now
          </Button>
        </div>

        {/* Schedule Grid */}
        {scheduleData.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Schedule Data</h3>
            <p className="text-gray-500">
              Make sure your Google Sheet has data and is properly formatted.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {scheduleData.map((item, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {headers.map((header, headerIndex) => {
                    const value = item[header];
                    let icon = null;
                    
                    // Smart icon detection
                    if (header.toLowerCase().includes('date') || header.toLowerCase().includes('day')) {
                      icon = <Calendar className="w-4 h-4" style={{ color: '#264d44' }} />;
                    } else if (header.toLowerCase().includes('time')) {
                      icon = <Clock className="w-4 h-4" style={{ color: '#770142' }} />;
                    } else if (header.toLowerCase().includes('location') || header.toLowerCase().includes('room')) {
                      icon = <MapPin className="w-4 h-4" style={{ color: '#013f7c' }} />;
                    } else if (header.toLowerCase().includes('client') || header.toLowerCase().includes('attendee')) {
                      icon = <Users className="w-4 h-4" style={{ color: '#264d44' }} />;
                    }

                    return (
                      <div key={headerIndex} className="flex items-start gap-2">
                        {icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            {header}
                          </p>
                          <p className="text-sm text-gray-800 font-medium break-words">
                            {value || '—'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Data Stats */}
        <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
          <p>
            Showing {scheduleData.length} {scheduleData.length === 1 ? 'entry' : 'entries'}
          </p>
          <p>
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}