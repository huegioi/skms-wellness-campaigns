import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, AlertCircle, Clock, Users, FileText, Send, CheckCircle2, Eye, ListTodo } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { productCatalog } from '@/components/curriculum/catalogData';
import ClientTaskCard from '@/components/tasks/ClientTaskCard';

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState('month');

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: proposals = [], isLoading: loadingProposals } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list()
  });

  const isLoading = loadingInvoices || loadingClients || loadingProposals;

  // Calculate proposal analytics
  const calculateProposalAnalytics = () => {
    const totalProposals = proposals.length;
    const sentProposals = proposals.filter(p => ['sent', 'viewed', 'accepted', 'declined'].includes(p.status)).length;
    const acceptedProposals = proposals.filter(p => p.status === 'accepted').length;
    const viewedProposals = proposals.filter(p => p.viewed_date).length;
    const acceptanceRate = sentProposals > 0 ? ((acceptedProposals / sentProposals) * 100).toFixed(1) : 0;
    const viewRate = sentProposals > 0 ? ((viewedProposals / sentProposals) * 100).toFixed(1) : 0;
    const totalValue = proposals.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const avgValue = totalProposals > 0 ? totalValue / totalProposals : 0;
    const acceptedValue = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + (p.total_amount || 0), 0);

    // Status distribution
    const statusData = [
      { name: 'Draft', value: proposals.filter(p => p.status === 'draft').length, color: '#9CA3AF' },
      { name: 'Sent', value: proposals.filter(p => p.status === 'sent').length, color: '#3B82F6' },
      { name: 'Viewed', value: proposals.filter(p => p.status === 'viewed').length, color: '#8B5CF6' },
      { name: 'Accepted', value: proposals.filter(p => p.status === 'accepted').length, color: '#22C55E' },
      { name: 'Declined', value: proposals.filter(p => p.status === 'declined').length, color: '#EF4444' }
    ].filter(d => d.value > 0);

    // Service popularity
    const serviceCounts = { workshops: {}, challenges: {}, leadership: {}, classes: {} };
    proposals.forEach(p => {
      const sel = p.selections || {};
      (sel.workshops || []).forEach(k => { serviceCounts.workshops[k] = (serviceCounts.workshops[k] || 0) + 1; });
      (sel.challengePrograms || []).forEach(k => { serviceCounts.challenges[k] = (serviceCounts.challenges[k] || 0) + 1; });
      (sel.leadership || []).forEach(k => { serviceCounts.leadership[k] = (serviceCounts.leadership[k] || 0) + 1; });
      (sel.movementClasses || []).forEach(k => { serviceCounts.classes[k] = (serviceCounts.classes[k] || 0) + 1; });
    });

    const topServices = [
      ...Object.entries(serviceCounts.workshops).map(([k, v]) => ({ name: productCatalog.workshops[k]?.name || k, count: v, type: 'Workshop' })),
      ...Object.entries(serviceCounts.challenges).map(([k, v]) => ({ name: productCatalog.challenges[k]?.name || k, count: v, type: 'Challenge' })),
      ...Object.entries(serviceCounts.leadership).map(([k, v]) => ({ name: productCatalog.leadership[k]?.name || k, count: v, type: 'Leadership' })),
      ...Object.entries(serviceCounts.classes).map(([k, v]) => ({ name: productCatalog.movementClasses[k]?.name || k, count: v, type: 'Class' }))
    ].sort((a, b) => b.count - a.count).slice(0, 8);

    // Monthly trends
    const monthlyData = {};
    proposals.forEach(p => {
      const month = new Date(p.created_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyData[month]) monthlyData[month] = { month, count: 0, value: 0, accepted: 0 };
      monthlyData[month].count++;
      monthlyData[month].value += p.total_amount || 0;
      if (p.status === 'accepted') monthlyData[month].accepted++;
    });
    const trendData = Object.values(monthlyData).slice(-6);

    // Response times
    const responseTimes = proposals
      .filter(p => p.sent_date && p.viewed_date)
      .map(p => {
        const sent = new Date(p.sent_date);
        const viewed = new Date(p.viewed_date);
        return (viewed - sent) / (1000 * 60 * 60);
      });
    const avgViewTime = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : 0;

    return {
      totalProposals,
      sentProposals,
      acceptanceRate,
      viewRate,
      avgValue,
      acceptedValue,
      totalValue,
      avgViewTime,
      statusData,
      topServices,
      trendData
    };
  };

  // Calculate invoice metrics
  const calculateMetrics = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startDate = timeframe === 'month' ? startOfMonth : startOfQuarter;

    const periodInvoices = invoices.filter(inv => 
      new Date(inv.created_date) >= startDate
    );

    const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const outstanding = invoices.filter(inv => ['sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const dueSoon = invoices.filter(inv => {
      if (inv.status !== 'sent') return false;
      const dueDate = new Date(inv.due_date);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    }).length;

    return { totalInvoiced, totalPaid, outstanding, dueSoon };
  };

  const metrics = calculateMetrics();
  const proposalAnalytics = calculateProposalAnalytics();

  // Get clients with pending tasks
  const clientsWithPendingTasks = clients.filter(client => {
    const clientTasks = allTasks.filter(t => t.client_id === client.id && t.status === 'pending');
    return clientTasks.length > 0;
  }).slice(0, 6);

  // Generate activity feed
  const generateActivityFeed = () => {
    const activities = [];

    // Recent clients
    clients.slice(-10).forEach(client => {
      activities.push({
        type: 'client',
        icon: Users,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        title: 'New Client Added',
        description: client.name,
        date: new Date(client.created_date)
      });
    });

    // Recent invoices
    invoices.slice(-10).forEach(invoice => {
      if (invoice.status === 'sent') {
        activities.push({
          type: 'invoice_sent',
          icon: Send,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          title: 'Invoice Sent',
          description: `${invoice.client_name} - $${invoice.total_amount?.toLocaleString()}`,
          date: new Date(invoice.created_date)
        });
      } else if (invoice.status === 'paid') {
        activities.push({
          type: 'invoice_paid',
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          title: 'Invoice Paid',
          description: `${invoice.client_name} - $${invoice.total_amount?.toLocaleString()}`,
          date: invoice.paid_date ? new Date(invoice.paid_date) : new Date(invoice.created_date)
        });
      }
    });

    // Recent proposals
    proposals.slice(-10).forEach(proposal => {
      if (proposal.status === 'sent') {
        activities.push({
          type: 'proposal_sent',
          icon: FileText,
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          title: 'Proposal Sent',
          description: `${proposal.client_name} - $${proposal.total_amount?.toLocaleString()}`,
          date: proposal.sent_date ? new Date(proposal.sent_date) : new Date(proposal.created_date)
        });
      } else if (proposal.status === 'accepted') {
        activities.push({
          type: 'proposal_accepted',
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          title: 'Proposal Accepted',
          description: `${proposal.client_name} - $${proposal.total_amount?.toLocaleString()}`,
          date: new Date(proposal.created_date)
        });
      }
    });

    return activities.sort((a, b) => b.date - a.date).slice(0, 15);
  };

  const activityFeed = generateActivityFeed();

  const StatCard = ({ title, value, icon: Icon, trend, color = "text-gray-600" }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {trend && (
              <p className="text-sm text-gray-500 mt-1">{trend}</p>
            )}
          </div>
          <div className={`p-4 rounded-full ${color.replace('text', 'bg').replace('600', '100')}`}>
            <Icon className={`w-8 h-8 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Dashboard
          </h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your business.</p>
        </div>

        {/* Timeframe Selector */}
        <div className="mb-6">
          <Tabs value={timeframe} onValueChange={setTimeframe}>
            <TabsList>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="quarter">This Quarter</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Open Clients Section */}
        {clientsWithPendingTasks.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="w-5 h-5" />
                Open Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientsWithPendingTasks.map(client => (
                  <ClientTaskCard key={client.id} client={client} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={`Total Invoiced (${timeframe === 'month' ? 'This Month' : 'This Quarter'})`}
            value={`$${metrics.totalInvoiced.toLocaleString()}`}
            icon={DollarSign}
            color="text-blue-600"
          />
          <StatCard
            title="Total Paid"
            value={`$${metrics.totalPaid.toLocaleString()}`}
            icon={CheckCircle2}
            color="text-green-600"
          />
          <StatCard
            title="Outstanding"
            value={`$${metrics.outstanding.toLocaleString()}`}
            icon={TrendingUp}
            color="text-orange-600"
          />
          <StatCard
            title="Due Soon (7 days)"
            value={metrics.dueSoon}
            icon={Clock}
            color="text-red-600"
          />
        </div>

        {/* Proposal Analytics Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#013f7c' }}>Proposal Analytics</h2>
          
          {/* Proposal KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Proposals</p>
                    <p className="text-2xl font-bold">{proposalAnalytics.totalProposals}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Acceptance Rate</p>
                    <p className="text-2xl font-bold">{proposalAnalytics.acceptanceRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg. Value</p>
                    <p className="text-2xl font-bold">${proposalAnalytics.avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg. View Time</p>
                    <p className="text-2xl font-bold">{proposalAnalytics.avgViewTime}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#264d44] to-[#1a3830] rounded-xl p-5 text-white">
              <p className="text-sm opacity-80">Total Pipeline</p>
              <p className="text-2xl font-bold">${proposalAnalytics.totalValue.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-[#770142] to-[#441d37] rounded-xl p-5 text-white">
              <p className="text-sm opacity-80">Won Revenue</p>
              <p className="text-2xl font-bold">${proposalAnalytics.acceptedValue.toLocaleString()}</p>
            </div>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Send className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Sent</p>
                    <p className="text-2xl font-bold">{proposalAnalytics.sentProposals}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Eye className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">View Rate</p>
                    <p className="text-2xl font-bold">{proposalAnalytics.viewRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle style={{ color: '#264d44' }}>Proposal Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {proposalAnalytics.statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie 
                        data={proposalAnalytics.statusData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={100} 
                        dataKey="value" 
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {proposalAnalytics.statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-400">No data yet</div>
                )}
              </CardContent>
            </Card>

            {/* Top Services */}
            <Card>
              <CardHeader>
                <CardTitle style={{ color: '#264d44' }}>Most Popular Services</CardTitle>
              </CardHeader>
              <CardContent>
                {proposalAnalytics.topServices.length > 0 ? (
                  <div className="space-y-3">
                    {proposalAnalytics.topServices.map((service, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{
                          background: service.type === 'Workshop' ? '#e0f2fe' : service.type === 'Challenge' ? '#fce7f3' : service.type === 'Leadership' ? '#f3e8ff' : '#dcfce7',
                          color: service.type === 'Workshop' ? '#0369a1' : service.type === 'Challenge' ? '#be185d' : service.type === 'Leadership' ? '#7c3aed' : '#16a34a'
                        }}>
                          {service.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{service.name}</p>
                          <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                            <div 
                              className="h-2 rounded-full" 
                              style={{ 
                                width: `${(service.count / proposalAnalytics.topServices[0].count) * 100}%`, 
                                background: '#264d44' 
                              }} 
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">{service.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-400">No data yet</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle style={{ color: '#264d44' }}>Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {proposalAnalytics.trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={proposalAnalytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value, name) => name === 'value' ? `$${value.toLocaleString()}` : value} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="count" name="Proposals" stroke="#013f7c" strokeWidth={2} dot={{ fill: '#013f7c' }} />
                    <Line yAxisId="left" type="monotone" dataKey="accepted" name="Accepted" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E' }} />
                    <Line yAxisId="right" type="monotone" dataKey="value" name="Total Value" stroke="#770142" strokeWidth={2} dot={{ fill: '#770142' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-400">No data yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {activityFeed.map((activity, idx) => {
                  const Icon = activity.icon;
                  return (
                    <div key={idx} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className={`p-2 rounded-lg ${activity.bgColor}`}>
                        <Icon className={`w-5 h-5 ${activity.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{activity.title}</p>
                        <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(activity.date, 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}