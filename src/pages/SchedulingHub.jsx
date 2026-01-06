import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Calendar, Clock, MapPin, Users, ExternalLink } from 'lucide-react';

export default function SchedulingHub() {
  const SPREADSHEET_ID = '1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0';
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schedule', SPREADSHEET_ID],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncGoogleSheets', {});
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

  const sheets = data?.sheets || [];
  const spreadsheetTitle = data?.title || 'Scheduling Hub';

  // Parse upcoming events from all sheets
  const getUpcomingEvents = () => {
    const events = [];
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    sheets.forEach(sheet => {
      sheet.data.forEach(row => {
        // Look for date columns (common names and check all columns)
        let dateValue = null;
        let dateKey = null;
        
        for (const [key, value] of Object.entries(row)) {
          if (key.toLowerCase().includes('date') || key.toLowerCase().includes('day')) {
            dateValue = value;
            dateKey = key;
            break;
          }
        }
        
        if (!dateValue) return;

        // Parse date - handle various formats
        let eventDate;
        try {
          // Try parsing as-is
          eventDate = new Date(dateValue);
          
          // If invalid, try common formats
          if (isNaN(eventDate.getTime())) {
            // Try MM/DD/YYYY or M/D/YYYY
            const parts = dateValue.split('/');
            if (parts.length === 3) {
              eventDate = new Date(parts[2], parts[0] - 1, parts[1]);
            }
          }
          
          if (isNaN(eventDate.getTime())) return;
        } catch {
          return;
        }

        // Check if within next month
        if (eventDate >= now && eventDate <= nextMonth) {
          // Find event/service name
          let title = 'Untitled Event';
          for (const [key, value] of Object.entries(row)) {
            if ((key.toLowerCase().includes('event') || 
                 key.toLowerCase().includes('service') || 
                 key.toLowerCase().includes('title') ||
                 key.toLowerCase().includes('name')) && value) {
              title = value;
              break;
            }
          }
          
          events.push({
            date: eventDate,
            title,
            client: row['Client'] || row['Payee'] || row['Company'] || row['CLIENT'] || row['client'] || row['PAYEE'] || '',
            location: row['Location'] || row['LOCATION'] || row['location'] || row['Venue'] || row['VENUE'] || '',
            time: row['Time'] || row['TIME'] || row['time'] || '',
            sheet: sheet.name,
            rawRow: row
          });
        }
      });
    });

    return events.sort((a, b) => a.date - b.date);
  };

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8" style={{ color: '#013f7c' }} />
              <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>
                {spreadsheetTitle}
              </h1>
            </div>
            <p className="text-gray-600">
              Real-time sync with Google Sheets • Auto-updates every 30 seconds
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#264d44] hover:bg-[#1a3830]">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Sheet
              </Button>
            </a>
          </div>
        </div>

        {/* Coming Up Section */}
        {upcomingEvents.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#013f7c' }}>
                <Clock className="w-5 h-5" />
                Coming Up (Next 30 Days)
              </h2>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 8).map((event, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-blue-100 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="font-semibold text-sm" style={{ color: '#013f7c' }}>
                            {event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          {event.time && (
                            <div className="text-xs text-gray-600">{event.time}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">{event.title}</div>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                          {event.client && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {event.client}
                            </span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">• {event.sheet}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {upcomingEvents.length > 8 && (
                <p className="text-sm text-gray-500 mt-3 text-center">
                  +{upcomingEvents.length - 8} more event{upcomingEvents.length - 8 !== 1 ? 's' : ''} coming up
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Sheets Tabs */}
        {sheets.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Schedule Data</h3>
            <p className="text-gray-500">
              Make sure your Google Sheet has data and is properly formatted.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue="0" className="w-full">
            <TabsList className="mb-6 flex-wrap h-auto">
              {sheets.map((sheet, index) => (
                <TabsTrigger key={index} value={index.toString()}>
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {sheets.map((sheet, sheetIndex) => (
              <TabsContent key={sheetIndex} value={sheetIndex.toString()}>
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#264d44] text-white">
                        <tr>
                          {sheet.headers.map((header, idx) => (
                            <th key={idx} className="px-4 py-3 text-left text-sm font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sheet.data.length > 0 ? (
                          sheet.data.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                              {sheet.headers.map((header, colIdx) => (
                                <td key={colIdx} className="px-4 py-3 text-sm text-gray-700">
                                  {row[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td 
                              colSpan={sheet.headers.length} 
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              No data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-refreshing every 30 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
}