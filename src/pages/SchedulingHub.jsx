import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink, Clock } from 'lucide-react';

export default function SchedulingHub() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['schedule'],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncGoogleSheetSchedule');
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true
  });

  const handleManualRefresh = () => {
    refetch();
  };

  const schedule = data?.schedule || [];
  const lastUpdated = data?.lastUpdated;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[#264d44] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2 text-gray-800">Error Loading Schedule</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
              Scheduling Hub
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              {lastUpdated && (
                <span>
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
              <span className="text-green-600 ml-2">● Live sync every 30s</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleManualRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <a
              href="https://docs.google.com/spreadsheets/d/1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0/edit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Open Sheet
              </Button>
            </a>
          </div>
        </div>

        {/* Schedule Data */}
        {schedule.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">No schedule data found in the Google Sheet.</p>
          </Card>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#264d44] text-white">
                  <tr>
                    {Object.keys(schedule[0]).map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-sm font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {schedule.map((row, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {Object.values(row).map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 text-sm text-gray-700"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats */}
        {schedule.length > 0 && (
          <div className="mt-6 flex gap-4">
            <Card className="p-4 flex-1">
              <p className="text-sm text-gray-600 mb-1">Total Entries</p>
              <p className="text-2xl font-bold" style={{ color: '#264d44' }}>
                {schedule.length}
              </p>
            </Card>
            <Card className="p-4 flex-1">
              <p className="text-sm text-gray-600 mb-1">Columns</p>
              <p className="text-2xl font-bold" style={{ color: '#264d44' }}>
                {Object.keys(schedule[0]).length}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}