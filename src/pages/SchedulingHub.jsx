import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, Clock, ExternalLink } from 'lucide-react';

export default function SchedulingHub() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedules = async () => {
    try {
      setRefreshing(true);
      const response = await base44.functions.invoke('syncGoogleSheet', {});
      setSchedules(response.data.schedules || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    
    // Auto-refresh every 30 seconds for real-time sync
    const interval = setInterval(fetchSchedules, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#013f7c' }} />
          <p className="text-gray-600">Loading schedules...</p>
        </div>
      </div>
    );
  }

  // Get all unique headers from the data
  const headers = schedules.length > 0 ? Object.keys(schedules[0]).filter(key => key !== 'id') : [];

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
              Scheduling Hub
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Synced with Google Sheets
              {lastUpdated && (
                <span className="text-sm">
                  • Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchSchedules}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => window.open('https://docs.google.com/spreadsheets/d/1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0/edit', '_blank')}
              className="flex items-center gap-2 bg-[#264d44] hover:bg-[#1a3830]"
            >
              <ExternalLink className="w-4 h-4" />
              Open Sheet
            </Button>
          </div>
        </div>

        {/* Auto-refresh indicator */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            Auto-refreshing every 30 seconds
          </span>
        </div>

        {/* Schedule Data */}
        {schedules.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 mb-2">No schedule data found</p>
            <p className="text-sm text-gray-500">
              Make sure your Google Sheet has data and try refreshing
            </p>
          </Card>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#264d44] text-white">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="px-6 py-4 text-left text-sm font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {schedules.map((schedule, index) => (
                    <tr key={schedule.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {headers.map((header) => (
                        <td key={header} className="px-6 py-4 text-sm text-gray-700">
                          {schedule[header]}
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
        {schedules.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-sm text-gray-600 mb-1">Total Entries</p>
              <p className="text-2xl font-bold" style={{ color: '#013f7c' }}>
                {schedules.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600 mb-1">Columns</p>
              <p className="text-2xl font-bold" style={{ color: '#264d44' }}>
                {headers.length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-gray-600 mb-1">Sync Status</p>
              <p className="text-lg font-semibold text-green-600 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Active
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}