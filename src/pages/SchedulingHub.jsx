import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Calendar, ExternalLink, Clock } from 'lucide-react';

export default function SchedulingHub() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['googleSheetSchedule'],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncGoogleSheet', {});
      return response.data;
    },
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10 seconds
    refetchIntervalInBackground: true
  });

  const renderTable = (sheetData) => {
    if (!sheetData || sheetData.length === 0) {
      return <p className="text-gray-500 text-center py-8">No data available</p>;
    }

    const headers = sheetData[0] || [];
    const rows = sheetData.slice(1);

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#013f7c] text-white">
              {headers.map((header, idx) => (
                <th key={idx} className="px-4 py-3 text-left font-semibold border border-gray-300">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {headers.map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-3 border border-gray-300">
                    {row[colIdx] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Schedule</h2>
          <p className="text-gray-600 mb-4">{error.message || 'Failed to load schedule data'}</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#013f7c] flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#013f7c' }}>
                  {data?.spreadsheetTitle || 'Scheduling Hub'}
                </h1>
                {data?.lastUpdated && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <Clock className="w-3 h-3" />
                    Last synced: {new Date(data.lastUpdated).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'border-green-500 text-green-600' : ''}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Now
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://docs.google.com/spreadsheets/d/1dc8dAKe3HD161JMmrMyQgDOzDzTZS_RYME5MbuN9OY0/edit', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Sheet
              </Button>
            </div>
          </div>
        </div>

        {/* Schedule Data */}
        {isLoading && !data ? (
          <Card className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#013f7c]" />
            <p className="text-gray-600">Loading schedule data...</p>
          </Card>
        ) : data?.sheets && data.sheets.length > 0 ? (
          <Card className="overflow-hidden">
            {data.sheets.length === 1 ? (
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: '#264d44' }}>
                  {data.sheets[0].sheetTitle}
                </h2>
                {renderTable(data.sheets[0].data)}
              </div>
            ) : (
              <Tabs defaultValue={data.sheets[0]?.sheetTitle} className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none bg-gray-50 p-0">
                  {data.sheets.map((sheet, idx) => (
                    <TabsTrigger 
                      key={idx} 
                      value={sheet.sheetTitle}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#013f7c] data-[state=active]:bg-white"
                    >
                      {sheet.sheetTitle}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {data.sheets.map((sheet, idx) => (
                  <TabsContent key={idx} value={sheet.sheetTitle} className="p-6">
                    {renderTable(sheet.data)}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-gray-600">No schedule data found in the spreadsheet</p>
          </Card>
        )}
      </div>
    </div>
  );
}