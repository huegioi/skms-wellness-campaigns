import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function MarketingDashboard() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notionOpportunities', startDate, endDate, selectedSource],
    queryFn: async () => {
      const response = await base44.functions.invoke('fetchNotionOpportunities', {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        source: selectedSource
      });
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    initialData: { opportunities: [], total: 0 }
  });

  const opportunities = data?.opportunities || [];
  const allSources = [...new Set(opportunities.map(o => o.source))].filter(s => s !== 'Unknown').sort();

  // Calculate analytics
  const calculateAnalytics = () => {
    const sourceBreakdown = {};
    const monthlyData = {};

    opportunities.forEach(opp => {
      // Source breakdown
      const source = opp.source || 'Unknown';
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

      // Monthly breakdown
      const month = format(new Date(opp.created_time), 'MMM yy');
      if (!monthlyData[month]) monthlyData[month] = { month, count: 0 };
      monthlyData[month].count++;
    });

    const sourceData = Object.entries(sourceBreakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const timelineData = Object.values(monthlyData).slice(-6);

    return { sourceData, timelineData };
  };

  const { sourceData, timelineData } = calculateAnalytics();

  const COLORS = ['#264d44', '#770142', '#013f7c', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div className="space-y-8">
      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Source</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {allSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} className="w-full bg-[#264d44] hover:bg-[#1a3830]">
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Opportunities</p>
                <p className="text-3xl font-bold text-blue-600">{opportunities.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100 transition-all duration-300 group-hover:scale-110">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
          <div className="absolute inset-0 opacity-5 bg-blue-100 group-hover:opacity-10 transition-opacity"></div>
        </Card>

        <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Unique Sources</p>
                <p className="text-3xl font-bold text-purple-600">{allSources.length}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100 transition-all duration-300 group-hover:scale-110">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
          <div className="absolute inset-0 opacity-5 bg-purple-100 group-hover:opacity-10 transition-opacity"></div>
        </Card>

        <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <CardContent className="p-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Top Source</p>
                <p className="text-xl font-bold text-green-600">{sourceData[0]?.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{sourceData[0]?.value || 0} opportunities</p>
              </div>
              <div className="p-3 rounded-full bg-green-100 transition-all duration-300 group-hover:scale-110">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
          <div className="absolute inset-0 opacity-5 bg-green-100 group-hover:opacity-10 transition-opacity"></div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Opportunities by Source */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Opportunities by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown (Bar Chart) */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" name="Opportunities" fill="#264d44" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Opportunities Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="Opportunities" 
                  stroke="#264d44" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#264d44', stroke: '#fff', strokeWidth: 2 }} 
                  activeDot={{ r: 6, fill: '#fff', stroke: '#264d44', strokeWidth: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-gray-500">
        <RefreshCw className="w-4 h-4 inline mr-1" />
        Auto-refreshing every 30 seconds
      </div>
    </div>
  );
}