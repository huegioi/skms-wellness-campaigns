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

const DEAL_STAGES_CONFIG = [
  { name: 'Cold', color: '#B0BEC5' },
  { name: 'Wellness Box Sent', color: '#ADD8E6' },
  { name: 'Sales Kit Sent', color: '#87CEEB' },
  { name: 'Warm', color: '#FFD700' },
  { name: 'Engaged', color: '#FFA500' },
  { name: 'Call Booked', color: '#FF4500' },
  { name: 'Negotiation', color: '#DC143C' },
  { name: 'Service Booked', color: '#10B981' },
  { name: 'Paid', color: '#065F46' },
  { name: 'Deal Lost', color: '#696969' }
];

const SOURCE_COLORS = {
  'Smartlead': '#A78BFA',
  'Networking': '#86EFAC',
  'LinkedIn': '#93C5FD',
  'Referral': '#FDB462',
  'Unknown': '#D1D5DB'
};

const getSourceColor = (sourceName) => SOURCE_COLORS[sourceName] || '#E5E7EB';

export default function NotionPipelineSection() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notionOpportunities', startDate, endDate, selectedSource, selectedStage],
    queryFn: async () => {
      const response = await base44.functions.invoke('fetchNotionOpportunities', {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        source: selectedSource
      });
      return response.data;
    },
    refetchInterval: 30000,
    initialData: { opportunities: [], total: 0 }
  });

  const { data: rawInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const invoices = rawInvoices.filter((i) => !i.is_demo);

  const opportunities = (data?.opportunities || []).filter((opp) =>
    selectedStage === 'all' || opp.stage === selectedStage
  );

  const allSources = [...new Set((data?.opportunities || []).map((o) => o.source))].filter((s) => s !== 'Unknown').sort();
  const allStages = [...new Set((data?.opportunities || []).map((o) => o.stage))].filter((s) => s !== 'Unknown').sort();

  const calculateAnalytics = () => {
    const sourceBreakdown = {};
    const stageBreakdown = {};
    const monthlyData = {};

    opportunities.forEach((opp) => {
      const source = opp.source || 'Unknown';
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

      const stage = opp.stage || 'Unknown';
      stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;

      const month = format(new Date(opp.created_time), 'MMM yy');
      if (!monthlyData[month]) monthlyData[month] = { month, count: 0 };
      monthlyData[month].count++;
    });

    const sourceData = Object.entries(sourceBreakdown).
      map(([name, value]) => ({ name, value })).
      sort((a, b) => b.value - a.value);

    const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
    const paidClientCount = new Set(
      paidInvoices.
        map((inv) => inv.company || inv.client_name || inv.client_id).
        filter(Boolean)
    ).size;

    const stageData = DEAL_STAGES_CONFIG.map((config) => ({
      name: config.name,
      value: config.name === 'Paid' ? paidClientCount : stageBreakdown[config.name] || 0,
      color: config.color
    }));

    const timelineData = Object.values(monthlyData).slice(-6);

    return { sourceData, stageData, timelineData };
  };

  const { sourceData, stageData, timelineData } = calculateAnalytics();

  return (
    <div className="space-y-8">
      {/* Legacy banner */}
      <div className="bg-gray-100 border border-gray-300 text-gray-500 rounded-lg px-4 py-2.5 text-sm">
        Legacy data source — being phased out.
      </div>

      {/* Notion Opportunities Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold" style={{ color: '#264d44' }}>Sales Pipeline (Notion)</h2>
      </div>

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
                className="w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Source</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {allSources.map((source) =>
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Stage</label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {allStages.map((stage) =>
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 lg:col-span-4">
            <Button onClick={() => refetch()} className="w-full sm:w-auto bg-[#264d44] hover:bg-[#1a3830]">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
            {sourceData.length > 0 ?
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={95}
                    innerRadius={35}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}>
                    {sourceData.map((entry, index) =>
                      <Cell
                        key={`cell-${index}`}
                        fill={getSourceColor(entry.name)}
                        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }} />
                    )}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer> :
              <div className="h-[350px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            }
          </CardContent>
        </Card>

        {/* Source Breakdown (Bar Chart) */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle style={{ color: '#264d44' }}>Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ?
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" label={{ value: 'Number of Opportunities', position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" name="Opportunities" radius={[0, 8, 8, 0]}>
                    {sourceData.map((entry, index) =>
                      <Cell key={`cell-${index}`} fill={getSourceColor(entry.name)} />
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer> :
              <div className="h-[350px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            }
          </CardContent>
        </Card>
      </div>

      {/* Source to Stage Conversion */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader>
          <CardTitle style={{ color: '#264d44' }}>Source Performance by Stage</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-4">
          {sourceData.length > 0 ?
            <div className="w-full" style={{ height: '500px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  margin={{ top: 10, right: 20, left: 80, bottom: 100 }}
                  data={(() => {
                    const sourceStageData = {};
                    opportunities.forEach((opp) => {
                      const source = opp.source || 'Unknown';
                      if (!sourceStageData[source]) {
                        sourceStageData[source] = { source };
                        DEAL_STAGES_CONFIG.forEach((stage) => {
                          sourceStageData[source][stage.name] = 0;
                        });
                      }
                      const stage = opp.stage || 'Unknown';
                      if (sourceStageData[source][stage] !== undefined) {
                        sourceStageData[source][stage]++;
                      }
                    });
                    return Object.values(sourceStageData).filter((d) => d.source !== 'Unknown');
                  })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="source"
                    angle={-45}
                    textAnchor="end"
                    height={95}
                    interval={0}
                    tick={{ fontSize: 12, fill: '#374151' }} />
                  <YAxis
                    label={{
                      value: 'Opportunities',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 20,
                      style: { fontSize: '13px', fill: '#374151', fontWeight: '600' }
                    }}
                    tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      backgroundColor: '#fff'
                    }}
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg border shadow-lg">
                          <p className="font-semibold mb-2">{data.source}</p>
                          {payload.map((entry, index) => {
                            if (entry.value > 0) {
                              const stageName = entry.name;
                              const count = entry.value;
                              if (stageName === 'Paid') {
                                const paidOpps = opportunities.filter(opp =>
                                  opp.source === data.source && opp.stage === 'Paid'
                                );
                                const withSurvey = paidOpps.filter(opp => opp.post_event_notes_survey).length;
                                const complete = paidOpps.filter(opp => opp.complete).length;
                                return (
                                  <div key={index} className="mb-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                      <span className="font-medium">{stageName}: {count}</span>
                                    </div>
                                    {(withSurvey > 0 || complete > 0) && (
                                      <div className="ml-5 mt-1 text-xs text-gray-600 space-y-0.5">
                                        {withSurvey > 0 && <div>✓ Survey: {withSurvey}</div>}
                                        {complete > 0 && <div>✓ Complete: {complete}</div>}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <div key={index} className="flex items-center gap-2 mb-1">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span>{stageName}: {count}</span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    }} />
                  <Legend
                    wrapperStyle={{ paddingTop: '15px' }}
                    iconType="circle"
                    iconSize={8} />
                  {DEAL_STAGES_CONFIG.map((stage) =>
                    <Bar
                      key={stage.name}
                      dataKey={stage.name}
                      stackId="a"
                      fill={stage.color}
                      name={stage.name} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div> :
            <div className="h-[500px] flex items-center justify-center text-gray-400">
              No data available
            </div>
          }
        </CardContent>
      </Card>

      {/* Stage Breakdown & Companies List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Stage Breakdown */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Opportunities by Stage</CardTitle>
          </CardHeader>
          <CardContent className="my-2 pt-6 pr-4 pb-2 pl-4 sm:px-6">
            {stageData.length > 0 ?
              <div className="w-full" style={{ height: '450px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 10, right: 20, left: 60, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={95}
                      interval={0}
                      tick={{ fontSize: 11, fill: '#374151' }} />
                    <YAxis
                      label={{
                        value: 'Count',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 15,
                        style: { fontSize: '13px', fill: '#374151', fontWeight: '600' }
                      }}
                      tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <Tooltip
                      formatter={(value) => [`${value} opportunities`]}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        backgroundColor: '#fff'
                      }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {stageData.map((entry, index) =>
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div> :
              <div className="h-[450px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            }
          </CardContent>
        </Card>

        {/* Paid Stage Details */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Paid Clients</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {(() => {
              const paidOpportunities = opportunities.filter(opp => opp.stage === 'Paid' && opp.company);
              return paidOpportunities.length > 0 ?
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {paidOpportunities.slice(0, 10).map((opp, idx) =>
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{opp.company}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{opp.source}</span>
                          {opp.post_event_notes_survey &&
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Survey</span>
                          }
                          {opp.complete &&
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Complete</span>
                          }
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">{format(new Date(opp.created_time), 'MMM d')}</span>
                    </div>
                  )}
                </div> :
                <div className="h-[280px] flex items-center justify-center text-gray-400">
                  No paid clients yet
                </div>
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Opportunities Over Time</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {timelineData.length > 0 ?
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timelineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Opportunities"
                  stroke="#264d44"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#264d44', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#fff', stroke: '#264d44', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer> :
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No data available
            </div>
          }
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