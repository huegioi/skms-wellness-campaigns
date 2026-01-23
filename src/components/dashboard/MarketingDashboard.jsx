import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, RefreshCw, Mail, UserPlus, UserMinus, Tag, MousePointerClick, FileText, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

const DEAL_STAGES_CONFIG = [
  { name: 'Cold', color: '#B0BEC5' },
  { name: 'Wellness Box Sent', color: '#ADD8E6' },
  { name: 'Sales Kit Sent', color: '#87CEEB' },
  { name: 'Warm', color: '#FFD700' },
  { name: 'Engaged', color: '#FFA500' },
  { name: 'Call Booked', color: '#FF4500' },
  { name: 'Negotiation', color: '#DC143C' },
  { name: 'Service Booked', color: '#228B22' },
  { name: 'Paid', color: '#008000' },
  { name: 'Deal Lost', color: '#696969' }
];

export default function MarketingDashboard() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [contactStartDate, setContactStartDate] = useState('');
  const [contactEndDate, setContactEndDate] = useState('');
  const [timePeriod, setTimePeriod] = useState('week');

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

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: kajabiStats, isLoading: kajabiLoading, refetch: refetchKajabi } = useQuery({
    queryKey: ['kajabiStats'],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncKajabi', { action: 'getStats' });
      return response.data?.stats || null;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    initialData: null
  });

  const { data: kajabiContacts = [] } = useQuery({
    queryKey: ['kajabiContacts'],
    queryFn: () => base44.entities.KajabiContact.list('-last_synced'),
    initialData: []
  });

  const syncKajabiContacts = async () => {
    try {
      await base44.functions.invoke('syncKajabi', { action: 'syncAll' });
      refetchKajabi();
    } catch (error) {
      console.error('Kajabi sync failed:', error);
    }
  };

  const opportunities = (data?.opportunities || []).filter(opp => 
    selectedStage === 'all' || opp.stage === selectedStage
  );

  const allSources = [...new Set((data?.opportunities || []).map(o => o.source))].filter(s => s !== 'Unknown').sort();
  const allStages = [...new Set((data?.opportunities || []).map(o => o.stage))].filter(s => s !== 'Unknown').sort();

  // Calculate analytics
  const calculateAnalytics = () => {
    const sourceBreakdown = {};
    const stageBreakdown = {};
    const monthlyData = {};

    opportunities.forEach(opp => {
      // Source breakdown
      const source = opp.source || 'Unknown';
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

      // Stage breakdown
      const stage = opp.stage || 'Unknown';
      stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;

      // Monthly breakdown
      const month = format(new Date(opp.created_time), 'MMM yy');
      if (!monthlyData[month]) monthlyData[month] = { month, count: 0 };
      monthlyData[month].count++;
    });

    const sourceData = Object.entries(sourceBreakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Get actual count of unique companies with paid invoices from QuickBooks
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const paidClientCount = new Set(
      paidInvoices
        .map(inv => inv.company || inv.client_name || inv.client_id)
        .filter(Boolean)
    ).size;

    const stageData = DEAL_STAGES_CONFIG.map(config => ({
      name: config.name,
      value: config.name === 'Paid' ? paidClientCount : (stageBreakdown[config.name] || 0),
      color: config.color
    }));

    const timelineData = Object.values(monthlyData).slice(-6);

    return { sourceData, stageData, timelineData };
  };

  const { sourceData, stageData, timelineData } = calculateAnalytics();

  const SOURCE_COLORS = {
    'Smartlead': '#A78BFA',
    'Networking': '#86EFAC',
    'LinkedIn': '#93C5FD',
    'Referral': '#FDB462',
    'Unknown': '#D1D5DB'
  };

  const getSourceColor = (sourceName) => SOURCE_COLORS[sourceName] || '#E5E7EB';

  const COLORS = ['#264d44', '#770142', '#013f7c', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

  // Calculate Kajabi contact growth trends with filters
  const kajabiTrendData = React.useMemo(() => {
    if (!kajabiContacts.length) return [];

    const filteredContacts = kajabiContacts.filter(contact => {
      const createdDate = new Date(contact.kajabi_created_at);
      const start = contactStartDate ? new Date(contactStartDate) : null;
      const end = contactEndDate ? new Date(contactEndDate) : null;
      
      if (start && createdDate < start) return false;
      if (end && createdDate > end) return false;
      return true;
    });

    const buckets = {};

    filteredContacts.forEach(contact => {
      const createdDate = new Date(contact.kajabi_created_at);
      let key, label;

      if (timePeriod === 'day') {
        key = createdDate.toISOString().split('T')[0];
        label = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (timePeriod === 'week') {
        const weekStart = new Date(createdDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0];
        label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        key = createdDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        label = key;
      }

      if (!buckets[key]) {
        buckets[key] = { key, label, subscribed: 0, unsubscribed: 0, total: 0 };
      }
      buckets[key].total++;
      if (contact.subscribed) buckets[key].subscribed++;
      else buckets[key].unsubscribed++;
    });

    return Object.values(buckets)
      .sort((a, b) => new Date(a.key) - new Date(b.key));
  }, [kajabiContacts, contactStartDate, contactEndDate, timePeriod]);

  // Tag tracking
  const tagData = React.useMemo(() => {
    if (!kajabiContacts.length) return [];
    
    const tagCounts = {};
    kajabiContacts.forEach(contact => {
      (contact.tags || []).forEach(tag => {
        if (!tagCounts[tag]) {
          tagCounts[tag] = { name: tag, subscribed: 0, unsubscribed: 0, total: 0 };
        }
        tagCounts[tag].total++;
        if (contact.subscribed) tagCounts[tag].subscribed++;
        else tagCounts[tag].unsubscribed++;
      });
    });

    return Object.values(tagCounts).sort((a, b) => b.total - a.total);
  }, [kajabiContacts]);

  const filteredTagData = selectedTags.length > 0 
    ? tagData.filter(t => selectedTags.includes(t.name))
    : tagData.slice(0, 10);

  return (
    <div className="space-y-8">
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
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Stage</label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {allStages.map(stage => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
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
            {sourceData.length > 0 ? (
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
                        paddingAngle={2}
                      >
                        {sourceData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={getSourceColor(entry.name)}
                            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        wrapperStyle={{ paddingTop: '10px' }}
                      />
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
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" name="Opportunities" radius={[0, 8, 8, 0]}>
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getSourceColor(entry.name)} />
                    ))}
                  </Bar>
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

      {/* Stage Breakdown & Companies List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Stage Breakdown */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Opportunities by Stage</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {stageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100} 
                    interval={0}
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value} opportunities`, 'Count']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <Bar dataKey="value" name="Count" radius={[8, 8, 0, 0]}>
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Companies */}
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Recent Companies</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {opportunities.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {opportunities.slice(0, 10).filter(opp => opp.company).map((opp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{opp.company}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{opp.source}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{opp.stage}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">{format(new Date(opp.created_time), 'MMM d')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">
                No opportunities yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>Opportunities Over Time</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
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
            <div className="h-[250px] flex items-center justify-center text-gray-400">
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

      {/* Kajabi Email Marketing Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: '#264d44' }}>Email Marketing (Kajabi)</h2>
          <Button 
            onClick={syncKajabiContacts} 
            variant="outline"
            className="border-[#264d44] text-[#264d44] hover:bg-[#264d44] hover:text-white"
            disabled={kajabiLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${kajabiLoading ? 'animate-spin' : ''}`} />
            Sync Kajabi
          </Button>
        </div>

        {kajabiStats ? (
          <>
            {/* Kajabi Contact KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6 z-10 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Total Contacts</p>
                      <p className="text-3xl font-bold text-blue-600">{kajabiStats.total}</p>
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
                      <p className="text-sm font-medium text-gray-500 mb-1">Subscribed</p>
                      <p className="text-3xl font-bold text-green-600">{kajabiStats.subscribed}</p>
                    </div>
                    <div className="p-3 rounded-full bg-green-100 transition-all duration-300 group-hover:scale-110">
                      <Mail className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 opacity-5 bg-green-100 group-hover:opacity-10 transition-opacity"></div>
              </Card>

              <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6 z-10 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">New (30 days)</p>
                      <p className="text-3xl font-bold text-purple-600">{kajabiStats.newLast30Days}</p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-100 transition-all duration-300 group-hover:scale-110">
                      <UserPlus className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 opacity-5 bg-purple-100 group-hover:opacity-10 transition-opacity"></div>
              </Card>

              <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6 z-10 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Unsubscribed</p>
                      <p className="text-3xl font-bold text-red-600">{kajabiStats.unsubscribed}</p>
                    </div>
                    <div className="p-3 rounded-full bg-red-100 transition-all duration-300 group-hover:scale-110">
                      <UserMinus className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 opacity-5 bg-red-100 group-hover:opacity-10 transition-opacity"></div>
              </Card>
            </div>

            {/* Engagement Metrics (Webhook-based) */}
            {kajabiStats.engagement && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="p-6 z-10 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Total Events (30d)</p>
                          <p className="text-3xl font-bold text-indigo-600">{kajabiStats.engagement.totalEvents}</p>
                        </div>
                        <div className="p-3 rounded-full bg-indigo-100 transition-all duration-300 group-hover:scale-110">
                          <MousePointerClick className="w-6 h-6 text-indigo-600" />
                        </div>
                      </div>
                    </CardContent>
                    <div className="absolute inset-0 opacity-5 bg-indigo-100 group-hover:opacity-10 transition-opacity"></div>
                  </Card>

                  <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="p-6 z-10 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Form Submissions</p>
                          <p className="text-3xl font-bold text-cyan-600">{kajabiStats.engagement.formSubmissions}</p>
                        </div>
                        <div className="p-3 rounded-full bg-cyan-100 transition-all duration-300 group-hover:scale-110">
                          <FileText className="w-6 h-6 text-cyan-600" />
                        </div>
                      </div>
                    </CardContent>
                    <div className="absolute inset-0 opacity-5 bg-cyan-100 group-hover:opacity-10 transition-opacity"></div>
                  </Card>

                  <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="p-6 z-10 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Tag Actions</p>
                          <p className="text-3xl font-bold text-amber-600">{kajabiStats.engagement.tagEngagements}</p>
                        </div>
                        <div className="p-3 rounded-full bg-amber-100 transition-all duration-300 group-hover:scale-110">
                          <Tag className="w-6 h-6 text-amber-600" />
                        </div>
                      </div>
                    </CardContent>
                    <div className="absolute inset-0 opacity-5 bg-amber-100 group-hover:opacity-10 transition-opacity"></div>
                  </Card>

                  <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="p-6 z-10 relative">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Conversions</p>
                          <p className="text-3xl font-bold text-emerald-600">{kajabiStats.engagement.conversions}</p>
                        </div>
                        <div className="p-3 rounded-full bg-emerald-100 transition-all duration-300 group-hover:scale-110">
                          <ShoppingCart className="w-6 h-6 text-emerald-600" />
                        </div>
                      </div>
                    </CardContent>
                    <div className="absolute inset-0 opacity-5 bg-emerald-100 group-hover:opacity-10 transition-opacity"></div>
                  </Card>
                </div>

                {/* Event Activity Chart */}
                {kajabiStats.engagement.topEvents && kajabiStats.engagement.topEvents.length > 0 && (
                  <Card className="hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle style={{ color: '#264d44' }}>Top Engagement Events (Last 30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={kajabiStats.engagement.topEvents}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Events" fill="#770142" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Top Tags Chart */}
            {kajabiStats.topTags && kajabiStats.topTags.length > 0 && (
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle style={{ color: '#264d44' }}>Top Contact Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={kajabiStats.topTags}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="Contacts" fill="#264d44" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Contact Growth Charts */}
            {kajabiContacts.length > 0 && (
              <>
                {/* Contact Growth Filters */}
                <Card>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Start Date</label>
                        <Input
                          type="date"
                          value={contactStartDate}
                          onChange={(e) => setContactStartDate(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">End Date</label>
                        <Input
                          type="date"
                          value={contactEndDate}
                          onChange={(e) => setContactEndDate(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Time Period</label>
                        <Select value={timePeriod} onValueChange={setTimePeriod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Daily</SelectItem>
                            <SelectItem value="week">Weekly</SelectItem>
                            <SelectItem value="month">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Growth Chart */}
                <Card className="hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle style={{ color: '#264d44' }}>
                      Contact Growth ({timePeriod === 'day' ? 'Daily' : timePeriod === 'week' ? 'Weekly' : 'Monthly'})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {kajabiTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        {timePeriod === 'day' || timePeriod === 'week' ? (
                          <BarChart data={kajabiTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="subscribed" name="Subscribed" stackId="a" fill="#22C55E" />
                            <Bar dataKey="unsubscribed" name="Unsubscribed" stackId="a" fill="#EF4444" />
                          </BarChart>
                        ) : (
                          <LineChart data={kajabiTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="subscribed" name="Subscribed" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E' }} />
                            <Line type="monotone" dataKey="unsubscribed" name="Unsubscribed" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444' }} />
                            <Line type="monotone" dataKey="total" name="Total" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-gray-400">No data in selected range</div>
                    )}
                  </CardContent>
                </Card>

                {/* Tag Performance */}
                <Card className="hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle style={{ color: '#264d44' }}>Tag Performance</CardTitle>
                      {tagData.length > 10 && (
                        <Select
                          value={selectedTags.length > 0 ? selectedTags.join(',') : 'top10'}
                          onValueChange={(value) => {
                            if (value === 'top10') {
                              setSelectedTags([]);
                            } else {
                              setSelectedTags(value.split(','));
                            }
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select tags" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top10">Top 10 Tags</SelectItem>
                            {tagData.slice(0, 20).map(tag => (
                              <SelectItem key={tag.name} value={tag.name}>{tag.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredTagData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={filteredTagData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={150} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="subscribed" name="Subscribed" fill="#22C55E" />
                          <Bar dataKey="unsubscribed" name="Unsubscribed" fill="#EF4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-400">No tags yet</div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No Kajabi data available yet</p>
              <Button onClick={syncKajabiContacts} className="bg-[#264d44] hover:bg-[#1a3830]">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Kajabi Contacts
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}